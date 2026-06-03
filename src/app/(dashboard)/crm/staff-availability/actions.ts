"use server";

import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  MANUAL_DAY_OFF_2026,
  MANUAL_SALON_DAY_OFF_2026,
  MANUAL_OPENING_2026,
} from "@/lib/schedule/manual-schedule-2026";
import type { DayOfWeek } from "@/lib/schedule/manual-schedule-2026";

// ── Permission ─────────────────────────────────────────────────────────────────

// Roles that may manage staff schedules operationally.
// csr_staff included so front-desk/CRM staff can configure schedules for MVP.
const SCHEDULE_MANAGER_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
  "csr_staff",  // front-desk operational access
]);

const SCHEDULE_PERMISSION_DENIED_MESSAGE =
  "You do not have permission to edit staff schedules. Please ask an owner or CRM admin.";

async function requireImportAccess(branchId: string) {
  // Session client — used only for auth checks (respects RLS).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    // Admin client bypasses the RLS policies that only cover manager/owner.
    // The action's own branch+role checks already provide the necessary guard.
    return { admin: createAdminClient(), userId: "dev-bypass" };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  if (!SCHEDULE_MANAGER_ROLES.has(me.system_role)) return null;
  // Non-owner must be on the same branch (branch-scoped access for CRM/CSR).
  if (me.system_role !== "owner" && me.branch_id !== branchId) return null;

  // Admin client bypasses staff_schedules RLS (INSERT/UPDATE policies only
  // cover 'manager' and 'owner' roles). The auth gate above already verified
  // that this user is an allowed role on this branch.
  return { admin: createAdminClient(), userId: me.id as string };
}

// ── Input schema ──────────────────────────────────────────────────────────────

const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const applyImportSchema = z
  .object({
    branchId: uuid,
    resolvedMatches: z
      .array(
        z.object({
          paperName: z.string().min(1),
          staffId: uuid,
        })
      )
      .min(1, "At least one staff match is required"),
    regularStart: timeStr,
    regularEnd: timeStr,
    openingStart: timeStr,
    openingEnd: timeStr,
  })
  .refine((d) => d.regularStart < d.regularEnd, {
    message: "Regular shift start must be before end time",
    path: ["regularEnd"],
  })
  .refine((d) => d.openingStart < d.openingEnd, {
    message: "Opening shift start must be before end time",
    path: ["openingEnd"],
  });

export type ApplyImportResult =
  | { ok: true; staffCount: number; rowsWritten: number }
  | { ok: false; error: string };

// ── Action ─────────────────────────────────────────────────────────────────────

/**
 * Applies the 2026 manual schedule import to the staff_schedules table.
 *
 * For each resolved match, writes 7 rows (one per day of week):
 *   - Day-off days  → is_active=false,  shift_type="single",  regular times
 *   - Opening days  → is_active=true,   shift_type="opening", opening times
 *   - Regular days  → is_active=true,   shift_type="single",  regular times
 *
 * Uses upsert on (staff_id, day_of_week, shift_type) — safe to re-run.
 */
export async function applyManualScheduleImportAction(
  rawInput: unknown
): Promise<ApplyImportResult> {
  const parsed = applyImportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const {
    branchId,
    resolvedMatches,
    regularStart,
    regularEnd,
    openingStart,
    openingEnd,
  } = parsed.data;

  const ctx = await requireImportAccess(branchId);
  if (!ctx) return { ok: false, error: SCHEDULE_PERMISSION_DENIED_MESSAGE };

  // Verify all staff IDs belong to this branch (admin client — bypasses RLS)
  const staffIds = resolvedMatches.map((m) => m.staffId);

  const { data: verifiedStaff, error: verifyErr } = await ctx.admin
    .from("staff")
    .select("id")
    .eq("branch_id", branchId)
    .in("id", staffIds);

  if (verifyErr) {
    return { ok: false, error: "Could not verify staff records" };
  }

  const verifiedIdSet = new Set((verifiedStaff ?? []).map((s) => s.id));
  const outsideIds = staffIds.filter((id) => !verifiedIdSet.has(id));
  if (outsideIds.length > 0) {
    return {
      ok: false,
      error: `${outsideIds.length} staff member(s) are not assigned to this branch`,
    };
  }

  // Build combined day-off map: dayOfWeek → Set<UPPER_NAME>
  const dayOffMap = new Map<number, Set<string>>();

  const addToOffMap = (day: number, names: string[]) => {
    const set = dayOffMap.get(day) ?? new Set<string>();
    for (const n of names) set.add(n.toUpperCase());
    dayOffMap.set(day, set);
  };

  for (const [d, names] of Object.entries(MANUAL_DAY_OFF_2026) as [
    string,
    string[],
  ][]) {
    addToOffMap(Number(d), names);
  }
  for (const [d, names] of Object.entries(MANUAL_SALON_DAY_OFF_2026) as [
    string,
    string[],
  ][]) {
    addToOffMap(Number(d), names);
  }

  // Opening map: dayOfWeek → Set<UPPER_NAME>
  const openingMap = new Map<number, Set<string>>();
  for (const [d, names] of Object.entries(MANUAL_OPENING_2026) as [
    string,
    string[],
  ][]) {
    openingMap.set(Number(d), new Set(names.map((n) => n.toUpperCase())));
  }

  // Build upsert rows
  type ScheduleRow = {
    staff_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    shift_type: string;
  };

  // Two different paper names may have been fuzzy-matched to the same staff ID
  // (e.g. RIZA and RIZZA both resolving to the same person). Build a combined
  // per-staff day pattern first so we never generate duplicate conflict keys.
  // For each staff ID we union all the paper names they were matched from, then
  // derive a single set of rows. Day-off wins: if ANY mapped name marks a day
  // as off, the staff is off that day.
  const staffPaperNames = new Map<string, string[]>();
  for (const { paperName, staffId } of resolvedMatches) {
    const names = staffPaperNames.get(staffId) ?? [];
    names.push(paperName.toUpperCase());
    staffPaperNames.set(staffId, names);
  }

  const rows: ScheduleRow[] = [];

  for (const [staffId, paperNames] of staffPaperNames) {
    for (let day = 0 as DayOfWeek; day <= 6; day++) {
      // Union across all paper names matched to this staff member
      const isOff     = paperNames.some((n) => dayOffMap.get(day)?.has(n) ?? false);
      const isOpening = paperNames.some((n) => openingMap.get(day)?.has(n) ?? false);

      if (isOff) {
        // Day off: write inactive record (day-off takes precedence over opening)
        rows.push({
          staff_id: staffId,
          day_of_week: day,
          start_time: regularStart,
          end_time: regularEnd,
          is_active: false,
          shift_type: "single",
        });
      } else if (isOpening) {
        // Opening duty: write active opening shift
        rows.push({
          staff_id: staffId,
          day_of_week: day,
          start_time: openingStart,
          end_time: openingEnd,
          is_active: true,
          shift_type: "opening",
        });
      } else {
        // Regular working day
        rows.push({
          staff_id: staffId,
          day_of_week: day,
          start_time: regularStart,
          end_time: regularEnd,
          is_active: true,
          shift_type: "single",
        });
      }
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "No schedule rows to write" };
  }

  // Batch upsert — safe to re-run, overwrites existing rows for same conflict key.
  // Uses admin client to bypass RLS (INSERT/UPDATE policies only cover manager/owner;
  // crm/csr_head are allowed at the action level above).
  const { error: upsertErr } = await ctx.admin
    .from("staff_schedules")
    .upsert(rows, { onConflict: "staff_id,day_of_week,shift_type" });

  if (upsertErr) {
    console.error("[schedule-import] upsert failed", {
      code: upsertErr.code,
      message: upsertErr.message,
      details: upsertErr.details,
      hint: upsertErr.hint,
    });
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "development"
          ? `Save failed: ${upsertErr.message}`
          : "Could not save schedule data. Please try again.",
    };
  }

  // Revalidate all affected CRM paths
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);

  // staffCount = unique staff members (multiple paper names may map to one person)
  return { ok: true, staffCount: staffPaperNames.size, rowsWritten: rows.length };
}

// ── Overnight-shift time helpers ─────────────────────────────────────────────

/** Converts "HH:MM" to total minutes from midnight (0–1439). */
function parseTimeToMinutes(time: string): number {
  const parts = time.split(":");
  return parseInt(parts[0] ?? "0", 10) * 60 + parseInt(parts[1] ?? "0", 10);
}

/**
 * Returns the duration in minutes between two HH:MM times.
 * If endTime <= startTime (crosses midnight), 24 hours are added to endTime
 * so that e.g. "17:00"–"01:30" = 8h 30m, not a negative/zero value.
 */
function getShiftDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);
  if (end <= start) end += 24 * 60; // overnight adjustment
  return end - start;
}

/** Returns true if any day in the pattern enables this shift (and is not a day-off). */
function isShiftEnabled(
  days: Array<{ opening: boolean; closing: boolean; regular: boolean; dayOff: boolean }>,
  shift: "opening" | "closing" | "regular"
): boolean {
  return days.some((d) => !d.dayOff && d[shift]);
}

// ── Save Staff Weekly Schedule Action ─────────────────────────────────────────

const dayPatternInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opening: z.boolean(),
  closing: z.boolean(),
  regular: z.boolean(),
  dayOff: z.boolean(),
});

const shiftTimesInputSchema = z.object({
  opening: z.object({ start: timeStr, end: timeStr }),
  closing: z.object({ start: timeStr, end: timeStr }),
  regular: z.object({ start: timeStr, end: timeStr }),
});

const saveStaffWeeklyScheduleSchema = z
  .object({
    staffId: uuid,
    branchId: uuid,
    days: z
      .array(dayPatternInputSchema)
      .refine((a) => a.length === 7, "Must provide all 7 days (0–6)"),
    times: shiftTimesInputSchema,
  })
  // Opening: only validate when at least one day uses it; allow overnight spans.
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "opening")) return true;
      const dur = getShiftDurationMinutes(d.times.opening.start, d.times.opening.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Opening shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "opening", "end"],
    }
  )
  // Closing: same rules — overnight OK (e.g. 17:00 → 01:30 = 8 h 30 m).
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "closing")) return true;
      const dur = getShiftDurationMinutes(d.times.closing.start, d.times.closing.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Closing shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "closing", "end"],
    }
  )
  // Regular: same rules.
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "regular")) return true;
      const dur = getShiftDurationMinutes(d.times.regular.start, d.times.regular.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Regular shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "regular", "end"],
    }
  );

export type SaveStaffWeeklyScheduleResult =
  | { ok: true; rowsWritten: number }
  | { ok: false; error: string };

/**
 * Saves a staff member's full weekly schedule.
 *
 * Writes exactly 21 rows (7 days × 3 shift types) to staff_schedules:
 *   - is_active=true  when that shift type is checked for that day (and not dayOff)
 *   - is_active=false when unchecked or dayOff
 *
 * Uses upsert on (staff_id, day_of_week, shift_type) — safe to re-run.
 */
export async function saveStaffWeeklyScheduleAction(
  rawInput: unknown
): Promise<SaveStaffWeeklyScheduleResult> {
  const parsed = saveStaffWeeklyScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { staffId, branchId, days, times } = parsed.data;

  const ctx = await requireImportAccess(branchId);
  if (!ctx) return { ok: false, error: SCHEDULE_PERMISSION_DENIED_MESSAGE };

  // Verify staff belongs to this branch
  const { data: staffRecord, error: verifyErr } = await ctx.admin
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (verifyErr) return { ok: false, error: "Could not verify staff record" };
  if (!staffRecord) return { ok: false, error: "Staff member not found in this branch" };

  // Build 21 rows (7 days × 3 shift types)
  type ScheduleRow = {
    staff_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    shift_type: string;
  };

  const rows: ScheduleRow[] = [];

  for (const day of days) {
    const { dayOfWeek, opening, closing, regular, dayOff } = day;

    rows.push({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: times.regular.start,
      end_time: times.regular.end,
      is_active: !dayOff && regular,
      shift_type: "single",
    });

    rows.push({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: times.opening.start,
      end_time: times.opening.end,
      is_active: !dayOff && opening,
      shift_type: "opening",
    });

    rows.push({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: times.closing.start,
      end_time: times.closing.end,
      is_active: !dayOff && closing,
      shift_type: "closing",
    });
  }

  const { error: upsertErr } = await ctx.admin
    .from("staff_schedules")
    .upsert(rows, { onConflict: "staff_id,day_of_week,shift_type" });

  if (upsertErr) {
    console.error("[save-staff-weekly-schedule] upsert failed", {
      code: upsertErr.code,
      message: upsertErr.message,
      details: upsertErr.details,
      hint: upsertErr.hint,
    });
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "development"
          ? `Save failed: ${upsertErr.message}`
          : "Could not save schedule. Please try again.",
    };
  }

  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);

  return { ok: true, rowsWritten: rows.length };
}
