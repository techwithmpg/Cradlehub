"use server";

import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  MANUAL_DAY_OFF_2026,
  MANUAL_SALON_DAY_OFF_2026,
  MANUAL_OPENING_2026,
} from "@/lib/schedule/manual-schedule-2026";
import type { DayOfWeek } from "@/lib/schedule/manual-schedule-2026";

// ── Permission ─────────────────────────────────────────────────────────────────

const IMPORT_ALLOWED_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
]);

async function requireImportAccess(branchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { supabase, userId: "dev-bypass" };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  if (!IMPORT_ALLOWED_ROLES.has(me.system_role)) return null;
  // Non-owner must be on the same branch
  if (me.system_role !== "owner" && me.branch_id !== branchId) return null;

  return { supabase, userId: me.id as string };
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

type ApplyImportInput = z.infer<typeof applyImportSchema>;

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
  if (!ctx) return { ok: false, error: "Unauthorized" };

  // Verify all staff IDs belong to this branch
  const staffIds = resolvedMatches.map((m) => m.staffId);

  const { data: verifiedStaff, error: verifyErr } = await ctx.supabase
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

  const rows: ScheduleRow[] = [];

  for (const { paperName, staffId } of resolvedMatches) {
    const upper = paperName.toUpperCase();

    for (let day = 0 as DayOfWeek; day <= 6; day++) {
      const isOff = dayOffMap.get(day)?.has(upper) ?? false;
      const isOpening = openingMap.get(day)?.has(upper) ?? false;

      if (isOff) {
        // Day off: write inactive record
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

  // Batch upsert — safe to re-run, overwrites existing rows for same conflict key
  const { error: upsertErr } = await ctx.supabase
    .from("staff_schedules")
    .upsert(rows, { onConflict: "staff_id,day_of_week,shift_type" });

  if (upsertErr) {
    console.error("[schedule-import] upsert failed", upsertErr.message);
    return {
      ok: false,
      error: "Could not save schedule data. Please try again.",
    };
  }

  // Revalidate all affected CRM paths
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);

  return { ok: true, staffCount: resolvedMatches.length, rowsWritten: rows.length };
}
