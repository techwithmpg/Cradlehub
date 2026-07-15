import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

export type DynamicClockOutSource =
  | "schedule"
  | "crm_closing"
  | "service_completion"
  | "home_service"
  | "driver_trip";

export type PortalClockOutMethod =
  | "staff_portal_home_service"
  | "staff_portal_closing_shift"
  | "driver_portal_final_trip";

export type DynamicClockOutPolicy = {
  checkinId: string;
  scheduledEndAt: string | null;
  expectedClockOutAt: string | null;
  earliestNormalClockOutAt: string | null;
  latestNormalClockOutAt: string | null;
  reminderAt: string | null;
  escalationAt: string | null;
  hardCutoffAt: string | null;
  provisionalClockOutAt: string | null;
  source: DynamicClockOutSource;
  snapshot: Record<string, unknown>;
  hasActiveAssignment: boolean;
  hasUpcomingAssignment: boolean;
  nextAssignmentAt: string | null;
  portalClockOutEligible: boolean;
  portalEligibilityReason: string;
  portalClockOutMethod: PortalClockOutMethod | null;
  changed: boolean;
};

export type DynamicClockOutClassification = "early" | "normal" | "overtime";

function record(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true";
}

export function parseDynamicClockOutPolicy(value: Json): DynamicClockOutPolicy {
  const result = record(value);
  const source = stringValue(result.attendance_policy_source);
  return {
    checkinId: stringValue(result.checkin_id) ?? "",
    scheduledEndAt: stringValue(result.scheduled_end_at),
    expectedClockOutAt: stringValue(result.attendance_expected_end_at),
    earliestNormalClockOutAt: stringValue(result.earliest_normal_clock_out_at),
    latestNormalClockOutAt: stringValue(result.latest_normal_clock_out_at),
    reminderAt: stringValue(result.clock_out_reminder_at),
    escalationAt: stringValue(result.manager_escalation_at),
    hardCutoffAt: stringValue(result.hard_cutoff_at),
    provisionalClockOutAt: stringValue(result.provisional_clock_out_at),
    source: source === "crm_closing"
      || source === "service_completion"
      || source === "home_service"
      || source === "driver_trip"
      ? source
      : "schedule",
    snapshot: record((result.attendance_policy_snapshot ?? null) as Json | null),
    hasActiveAssignment: booleanValue(result.has_active_assignment),
    hasUpcomingAssignment: booleanValue(result.has_upcoming_assignment),
    nextAssignmentAt: stringValue(result.next_assignment_at),
    portalClockOutEligible: booleanValue(result.portal_clock_out_eligible),
    portalEligibilityReason:
      stringValue(result.portal_eligibility_reason) ?? "use_branch_qr",
    portalClockOutMethod:
      result.portal_clock_out_method === "staff_portal_home_service"
      || result.portal_clock_out_method === "staff_portal_closing_shift"
      || result.portal_clock_out_method === "driver_portal_final_trip"
        ? result.portal_clock_out_method
        : null,
    changed: booleanValue(result.changed),
  };
}

export function classifyDynamicClockOut(input: {
  clockOutAt: string;
  earliestNormalClockOutAt: string | null;
  latestNormalClockOutAt: string | null;
}): DynamicClockOutClassification {
  const actual = new Date(input.clockOutAt).getTime();
  const earliest = input.earliestNormalClockOutAt
    ? new Date(input.earliestNormalClockOutAt).getTime()
    : Number.NaN;
  const latest = input.latestNormalClockOutAt
    ? new Date(input.latestNormalClockOutAt).getTime()
    : Number.NaN;
  if (Number.isFinite(earliest) && actual < earliest) return "early";
  if (Number.isFinite(latest) && actual > latest) return "overtime";
  return "normal";
}

export async function recalculateAttendanceClockOutPolicy(
  db: SupabaseClient<Database>,
  checkinId: string,
  calculatedAt = new Date().toISOString()
): Promise<DynamicClockOutPolicy> {
  const { data, error } = await db.rpc("recalculate_attendance_clock_out_policy", {
    p_checkin_id: checkinId,
    p_calculated_at: calculatedAt,
  });
  if (error) throw new Error(`Dynamic Attendance policy failed: ${error.message}`);
  return parseDynamicClockOutPolicy(data);
}
