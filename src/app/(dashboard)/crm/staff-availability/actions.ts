"use server";

import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canonicalizeSystemRole, isFrontDeskRole } from "@/constants/staff";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import {
  STAFF_SCHEDULE_CONFLICT_TARGET,
  STAFF_SCHEDULE_RETURNING_COLUMNS,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "@/lib/schedule/staff-schedule-write";
import {
  MANUAL_DAY_OFF_2026,
  MANUAL_SALON_DAY_OFF_2026,
  MANUAL_OPENING_2026,
} from "@/lib/schedule/manual-schedule-2026";
import type { DayOfWeek } from "@/lib/schedule/manual-schedule-2026";

// ── Permission ─────────────────────────────────────────────────────────────────

const SCHEDULE_PERMISSION_DENIED_MESSAGE =
  "You do not have permission to update this staff schedule.";
const GENERIC_SCHEDULE_SAVE_ERROR = "We could not update this schedule. Please try again.";
const INVALID_TIME_ERROR = "Please check the start and end times.";

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
    const admin = createAdminClient();
    return { admin, scheduleClient: admin, userId: "dev-bypass" };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  const role = canonicalizeSystemRole(me.system_role);
  if (!canAdjustStaffSchedule(role)) return null;
  // Non-owner must be on the same branch (branch-scoped access for CRM/CSR).
  if (!isOwner(role) && (me.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return null;
  }

  return { admin: createAdminClient(), scheduleClient: supabase, userId: me.id as string };
}

// ── Input schema ──────────────────────────────────────────────────────────────

const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

// ── Overnight-safe validation helpers (used by import schema) ─────────────────

function parseImportMinutes(t: string): number {
  const p = t.split(":");
  return parseInt(p[0] ?? "0", 10) * 60 + parseInt(p[1] ?? "0", 10);
}

/**
 * Duration-based shift validity check — supports overnight spans.
 * e.g. "17:00"–"01:00" = 8 h, not a parse error.
 */
function isValidImportShift(start: string, end: string): boolean {
  const s = parseImportMinutes(start);
  let e = parseImportMinutes(end);
  if (e <= s) e += 24 * 60; // overnight adjustment
  const dur = e - s;
  return dur > 0 && dur <= 16 * 60;
}

export type ScheduleImportTimes = {
  therapistOpeningStart: string;
  therapistOpeningEnd: string;
  therapistClosingStart: string;
  therapistClosingEnd: string;
  crmOpeningStart: string;
  crmOpeningEnd: string;
  crmClosingStart: string;
  crmClosingEnd: string;
  driverStart: string;
  driverEnd: string;
  utilityStart: string;
  utilityEnd: string;
  salonStart: string;
  salonEnd: string;
};

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
    // Grouped shift times — replaces old regularStart/regularEnd/openingStart/openingEnd
    therapistOpeningStart: timeStr,
    therapistOpeningEnd: timeStr,
    therapistClosingStart: timeStr,
    therapistClosingEnd: timeStr,
    crmOpeningStart: timeStr,
    crmOpeningEnd: timeStr,
    crmClosingStart: timeStr,
    crmClosingEnd: timeStr,
    driverStart: timeStr,
    driverEnd: timeStr,
    utilityStart: timeStr,
    utilityEnd: timeStr,
    salonStart: timeStr,
    salonEnd: timeStr,
  })
  .refine((d) => isValidImportShift(d.therapistOpeningStart, d.therapistOpeningEnd), {
    message: "Therapist opening shift times are invalid (must span 1 min – 16 h)",
    path: ["therapistOpeningEnd"],
  })
  .refine((d) => isValidImportShift(d.therapistClosingStart, d.therapistClosingEnd), {
    message: "Therapist closing shift times are invalid (must span 1 min – 16 h)",
    path: ["therapistClosingEnd"],
  })
  .refine((d) => isValidImportShift(d.crmOpeningStart, d.crmOpeningEnd), {
    message: "CRM opening shift times are invalid (must span 1 min – 16 h)",
    path: ["crmOpeningEnd"],
  })
  .refine((d) => isValidImportShift(d.crmClosingStart, d.crmClosingEnd), {
    message: "CRM closing shift times are invalid (must span 1 min – 16 h)",
    path: ["crmClosingEnd"],
  })
  .refine((d) => isValidImportShift(d.driverStart, d.driverEnd), {
    message: "Driver shift times are invalid (must span 1 min – 16 h)",
    path: ["driverEnd"],
  })
  .refine((d) => isValidImportShift(d.utilityStart, d.utilityEnd), {
    message: "Utility shift times are invalid (must span 1 min – 16 h)",
    path: ["utilityEnd"],
  })
  .refine((d) => isValidImportShift(d.salonStart, d.salonEnd), {
    message: "Salon shift times are invalid (must span 1 min – 16 h)",
    path: ["salonEnd"],
  });

export type ApplyImportResult =
  | { ok: true; staffCount: number; rowsWritten: number }
  | { ok: false; error: string };

// ── Action ─────────────────────────────────────────────────────────────────────

// ── Staff-type classification helper ─────────────────────────────────────────

type StaffClassification = {
  staff_type: string | null;
  system_role: string | null;
};

type ResolvedShift = {
  shiftType: "opening" | "closing" | "single";
  startTime: string;
  endTime: string;
  isActive: boolean;
};

/**
 * Determines what shift a staff member works for a given day.
 *
 * Business rules (priority order):
 *  1. Day-off → inactive single row (placeholder)
 *  2. Therapist (service provider) → opening/closing rotation
 *  3. CRM / CSR / Front Desk → opening/closing rotation (different times)
 *  4. Driver → regular single shift
 *  5. Utility → regular single shift
 *  6. Salon / Nail / Aesthetician / Facialist → regular single shift
 *  7. Unclassified → treat as therapist (backwards-compatible default)
 */
function resolveScheduleForStaffDay(
  staff: StaffClassification,
  isOff: boolean,
  isOpening: boolean,
  times: ScheduleImportTimes
): ResolvedShift {
  if (isOff) {
    // Day-off: write an inactive placeholder using salon times as neutral default
    return {
      shiftType: "single",
      startTime: times.salonStart,
      endTime: times.salonEnd,
      isActive: false,
    };
  }

  const staffType = (staff.staff_type ?? "").toLowerCase();
  const systemRole = (staff.system_role ?? "").toLowerCase();

  const isTherapist =
    staffType.includes("therapist") ||
    staffType.includes("nail_tech") ||
    staffType.includes("aesthetician") ||
    staffType.includes("facialist") ||
    staffType.includes("salon_head");

  const isCrm =
    staffType.includes("csr") ||
    staffType.includes("front") ||
    isFrontDeskRole(systemRole);

  const isDriver = staffType.includes("driver") || systemRole === "driver";
  const isUtility = staffType.includes("utility");
  const isSalon =
    staffType.includes("salon") ||
    staffType.includes("nail") ||
    staffType.includes("aesthetician") ||
    staffType.includes("facialist");

  if (isCrm) {
    // CRM/CSR/Front Desk: opening/closing rotation with CRM times
    if (isOpening) {
      return {
        shiftType: "opening",
        startTime: times.crmOpeningStart,
        endTime: times.crmOpeningEnd,
        isActive: true,
      };
    }
    return {
      shiftType: "closing",
      startTime: times.crmClosingStart,
      endTime: times.crmClosingEnd,
      isActive: true,
    };
  }

  if (isDriver) {
    return {
      shiftType: "single",
      startTime: times.driverStart,
      endTime: times.driverEnd,
      isActive: true,
    };
  }

  if (isUtility) {
    return {
      shiftType: "single",
      startTime: times.utilityStart,
      endTime: times.utilityEnd,
      isActive: true,
    };
  }

  if (isSalon && !isTherapist) {
    // Pure salon staff (nail tech listed separately as non-therapist)
    return {
      shiftType: "single",
      startTime: times.salonStart,
      endTime: times.salonEnd,
      isActive: true,
    };
  }

  // Therapist or unclassified (default) — opening/closing rotation with therapist times
  if (isOpening) {
    return {
      shiftType: "opening",
      startTime: times.therapistOpeningStart,
      endTime: times.therapistOpeningEnd,
      isActive: true,
    };
  }
  return {
    shiftType: "closing",
    startTime: times.therapistClosingStart,
    endTime: times.therapistClosingEnd,
    isActive: true,
  };
}

/**
 * Applies the 2026 manual schedule import to the staff_schedules table.
 *
 * For each resolved match, writes 21 rows (7 days × 3 shift types):
 *   - Day-off days → all 3 shift types inactive, single uses the inactive placeholder
 *   - Working days → the resolved active shift type gets is_active=true;
 *                    the other two shift types get is_active=false with fallback times
 *
 * Shift assignment by staff type:
 *   - Therapist / unclassified  → opening / closing rotation (therapist times)
 *   - CRM / CSR / Front Desk    → opening / closing rotation (CRM times)
 *   - Driver                    → regular single shift
 *   - Utility                   → regular single shift
 *   - Salon / Nail / Aesthetician → regular single shift
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

  const { branchId, resolvedMatches, ...times } = parsed.data;

  const ctx = await requireImportAccess(branchId);
  if (!ctx) return { ok: false, error: SCHEDULE_PERMISSION_DENIED_MESSAGE };

  // Verify all staff IDs belong to this branch and fetch staff_type + system_role
  // so resolveScheduleForStaffDay can classify each staff member correctly.
  const staffIds = resolvedMatches.map((m) => m.staffId);

  const { data: verifiedStaff, error: verifyErr } = await ctx.admin
    .from("staff")
    .select("id, staff_type, system_role")
    .eq("branch_id", branchId)
    .in("id", staffIds);

  if (verifyErr) {
    return { ok: false, error: "Could not verify staff records" };
  }

  const verifiedStaffList = verifiedStaff ?? [];
  const verifiedIdSet = new Set(verifiedStaffList.map((s) => s.id));
  const outsideIds = staffIds.filter((id) => !verifiedIdSet.has(id));
  if (outsideIds.length > 0) {
    return {
      ok: false,
      error: `${outsideIds.length} staff member(s) are not assigned to this branch`,
    };
  }

  // Build a quick lookup: staffId → classification
  type StaffRow = { id: string; staff_type?: string | null; system_role?: string | null };
  const staffClassMap = new Map<string, StaffClassification>();
  for (const s of verifiedStaffList as StaffRow[]) {
    staffClassMap.set(s.id, {
      staff_type: s.staff_type ?? null,
      system_role: s.system_role ?? null,
    });
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

  // Build upsert rows — 21 rows per staff (7 days × 3 shift types)
  type ScheduleRow = {
    staff_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    shift_type: string;
  };

  // Two different paper names may have been fuzzy-matched to the same staff ID.
  // Union their patterns: day-off wins across all mapped names.
  const staffPaperNames = new Map<string, string[]>();
  for (const { paperName, staffId } of resolvedMatches) {
    const names = staffPaperNames.get(staffId) ?? [];
    names.push(paperName.toUpperCase());
    staffPaperNames.set(staffId, names);
  }

  const rows: ScheduleRow[] = [];

  for (const [staffId, paperNames] of staffPaperNames) {
    const classification = staffClassMap.get(staffId) ?? {
      staff_type: null,
      system_role: null,
    };

    for (let day = 0 as DayOfWeek; day <= 6; day++) {
      // Union across all paper names mapped to this staff member
      const isOff     = paperNames.some((n) => dayOffMap.get(day)?.has(n) ?? false);
      const isOpening = !isOff && paperNames.some((n) => openingMap.get(day)?.has(n) ?? false);

      const active = resolveScheduleForStaffDay(classification, isOff, isOpening, times);

      // Write all 3 shift types for this day so the upsert covers every conflict key.
      // Only the resolved active shift gets is_active=true.
      rows.push({
        staff_id: staffId,
        day_of_week: day,
        shift_type: "opening",
        start_time: active.shiftType === "opening" ? active.startTime : times.therapistOpeningStart,
        end_time:   active.shiftType === "opening" ? active.endTime   : times.therapistOpeningEnd,
        is_active:  active.shiftType === "opening" && active.isActive,
      });

      rows.push({
        staff_id: staffId,
        day_of_week: day,
        shift_type: "closing",
        start_time: active.shiftType === "closing" ? active.startTime : times.therapistClosingStart,
        end_time:   active.shiftType === "closing" ? active.endTime   : times.therapistClosingEnd,
        is_active:  active.shiftType === "closing" && active.isActive,
      });

      rows.push({
        staff_id: staffId,
        day_of_week: day,
        shift_type: "single",
        start_time: active.shiftType === "single" ? active.startTime : times.salonStart,
        end_time:   active.shiftType === "single" ? active.endTime   : times.salonEnd,
        is_active:  active.shiftType === "single" && active.isActive,
      });
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
  | { ok: true; rowsWritten: number; savedRows: SavedStaffScheduleRow[] }
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
    const invalidTime = parsed.error.issues.some((issue) =>
      issue.path.some((part) => part === "times" || part === "start" || part === "end")
    );
    return { ok: false, error: invalidTime ? INVALID_TIME_ERROR : "Invalid input" };
  }

  const { staffId, branchId, days, times } = parsed.data;

  const ctx = await requireImportAccess(branchId);
  if (!ctx) return { ok: false, error: SCHEDULE_PERMISSION_DENIED_MESSAGE };

  // Verify staff belongs to this branch
  const { data: staffRecord, error: verifyErr } = await ctx.scheduleClient
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (verifyErr) {
    console.error("[save-staff-weekly-schedule] staff verification failed", {
      branchId,
      staffId,
      code: verifyErr.code,
      message: verifyErr.message,
    });
    return { ok: false, error: GENERIC_SCHEDULE_SAVE_ERROR };
  }
  if (!staffRecord) return { ok: false, error: "Staff member not found in this branch" };

  // Build 21 rows (7 days × 3 shift types)
  const rows: StaffScheduleUpsertRow[] = [];

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

  const { data: savedRows, error: upsertErr } = await ctx.scheduleClient
    .from("staff_schedules")
    .upsert(rows, { onConflict: STAFF_SCHEDULE_CONFLICT_TARGET })
    .select(STAFF_SCHEDULE_RETURNING_COLUMNS);

  if (upsertErr) {
    console.error("[save-staff-weekly-schedule] upsert failed", {
      code: upsertErr.code,
      message: upsertErr.message,
      details: upsertErr.details,
      hint: upsertErr.hint,
    });
    return {
      ok: false,
      error: GENERIC_SCHEDULE_SAVE_ERROR,
    };
  }

  const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: normalizedSavedRows })) {
    console.error("[save-staff-weekly-schedule] upsert returned unexpected row count", {
      branchId,
      staffId,
      requestedRows: rows.length,
      savedRows: normalizedSavedRows.length,
    });
    return { ok: false, error: GENERIC_SCHEDULE_SAVE_ERROR };
  }

  revalidatePath("/crm/schedule");
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);

  return { ok: true, rowsWritten: normalizedSavedRows.length, savedRows: normalizedSavedRows };
}
