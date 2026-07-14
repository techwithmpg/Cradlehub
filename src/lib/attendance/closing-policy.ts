import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";

export const ATTENDANCE_STAFF_CATEGORIES = [
  "crm_front_desk",
  "therapists",
  "salon",
  "drivers",
  "utility",
  "managers",
  "other",
] as const;

export type AttendanceStaffCategory = (typeof ATTENDANCE_STAFF_CATEGORIES)[number];

export const ATTENDANCE_STAFF_CATEGORY_LABELS: Record<AttendanceStaffCategory, string> = {
  crm_front_desk: "CRM / front desk",
  therapists: "Therapists",
  salon: "Salon",
  drivers: "Drivers",
  utility: "Utility",
  managers: "Managers",
  other: "Other staff",
};

export type AttendanceCategoryRuleValues = {
  late_grace_minutes: number | null;
  early_leave_threshold_minutes: number | null;
  overtime_threshold_minutes: number | null;
  active_service_blocks_clock_out: boolean | null;
  crm_closing_policy_enabled: boolean | null;
};

export type ClosingPolicySettings = {
  timezone: string;
  late_grace_minutes: number;
  early_leave_threshold_minutes: number;
  overtime_threshold_minutes: number;
  active_service_blocks_clock_out: boolean;
  crm_closing_policy_enabled: boolean;
  branch_operating_close_time: string;
  crm_closing_buffer_minutes: number;
  crm_manager_escalation_delay_minutes: number;
  crm_hard_cutoff_delay_minutes: number;
};

export type AttendanceClosingTimeline = {
  branchCloseAt: string;
  earliestNormalClockOutAt: string;
  latestNormalClockOutAt: string;
  reminderAt: string;
  managerEscalationAt: string;
  hardCutoffAt: string;
  provisionalClockOutAt: string;
};

export type ResolvedAttendancePolicy = {
  kind: "crm_closing" | "schedule";
  category: AttendanceStaffCategory;
  appliesCrmClosingPolicy: boolean;
  expectedEndAt: string | null;
  earliestNormalClockOutAt: string | null;
  latestNormalClockOutAt: string | null;
  reminderAt: string | null;
  managerEscalationAt: string | null;
  hardCutoffAt: string | null;
  provisionalClockOutAt: string | null;
  lateGraceMinutes: number;
  earlyLeaveThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  activeServiceBlocksClockOut: boolean;
  source: {
    branchRuleVersionId: string | null;
    categoryRuleId: string | null;
  };
};

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

export function resolveAttendanceStaffCategory(params: {
  systemRole?: string | null;
  staffType?: string | null;
}): AttendanceStaffCategory {
  const role = normalized(canonicalizeSystemRole(params.systemRole));
  const staffType = normalized(params.staffType);

  if (role === "crm" || staffType === "csr") return "crm_front_desk";
  if (["owner", "manager", "assistant_manager", "store_manager", "branch_manager", "super_admin", "platform_admin"].includes(role) || staffType === "managerial") {
    return "managers";
  }
  if (staffType === "therapist") return "therapists";
  if (["nail_tech", "aesthetician", "salon_head"].includes(staffType)) return "salon";
  if (role === "driver" || staffType === "driver") return "drivers";
  if (role === "utility" || staffType === "utility") return "utility";
  return "other";
}

export function isClosingShift(shiftType: string | null | undefined): boolean {
  return normalized(shiftType) === "closing";
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function deriveAttendanceClosingTimeline(params: {
  businessDate: string;
  timezone: string;
  branchCloseTime: string;
  normalBufferMinutes: number;
  managerEscalationDelayMinutes: number;
  hardCutoffDelayMinutes: number;
}): AttendanceClosingTimeline {
  const branchCloseAt = branchDateTimeToIsoInTimezone({
    date: params.businessDate,
    time: params.branchCloseTime,
    timezone: params.timezone,
  });
  const latestNormalClockOutAt = addMinutes(branchCloseAt, params.normalBufferMinutes);

  return {
    branchCloseAt,
    earliestNormalClockOutAt: branchCloseAt,
    latestNormalClockOutAt,
    reminderAt: latestNormalClockOutAt,
    managerEscalationAt: addMinutes(
      latestNormalClockOutAt,
      params.managerEscalationDelayMinutes
    ),
    hardCutoffAt: addMinutes(latestNormalClockOutAt, params.hardCutoffDelayMinutes),
    provisionalClockOutAt: latestNormalClockOutAt,
  };
}

export function resolveAttendancePolicy(params: {
  settings: ClosingPolicySettings;
  categoryRule?: Partial<AttendanceCategoryRuleValues> | null;
  systemRole?: string | null;
  staffType?: string | null;
  shiftType?: string | null;
  businessDate: string;
  scheduledEndAt?: string | null;
  branchRuleVersionId?: string | null;
  categoryRuleId?: string | null;
}): ResolvedAttendancePolicy {
  const category = resolveAttendanceStaffCategory(params);
  const override = params.categoryRule ?? {};
  const crmClosingPolicyEnabled =
    override.crm_closing_policy_enabled ?? params.settings.crm_closing_policy_enabled;
  const appliesCrmClosingPolicy =
    category === "crm_front_desk" && isClosingShift(params.shiftType) && crmClosingPolicyEnabled;
  const timeline = appliesCrmClosingPolicy
    ? deriveAttendanceClosingTimeline({
        businessDate: params.businessDate,
        timezone: params.settings.timezone,
        branchCloseTime: params.settings.branch_operating_close_time,
        normalBufferMinutes: params.settings.crm_closing_buffer_minutes,
        managerEscalationDelayMinutes:
          params.settings.crm_manager_escalation_delay_minutes,
        hardCutoffDelayMinutes: params.settings.crm_hard_cutoff_delay_minutes,
      })
    : null;

  return {
    kind: timeline ? "crm_closing" : "schedule",
    category,
    appliesCrmClosingPolicy,
    expectedEndAt: timeline?.latestNormalClockOutAt ?? params.scheduledEndAt ?? null,
    earliestNormalClockOutAt: timeline?.earliestNormalClockOutAt ?? null,
    latestNormalClockOutAt: timeline?.latestNormalClockOutAt ?? null,
    reminderAt: timeline?.reminderAt ?? null,
    managerEscalationAt: timeline?.managerEscalationAt ?? null,
    hardCutoffAt: timeline?.hardCutoffAt ?? null,
    provisionalClockOutAt: timeline?.provisionalClockOutAt ?? null,
    lateGraceMinutes:
      override.late_grace_minutes ?? params.settings.late_grace_minutes,
    earlyLeaveThresholdMinutes:
      override.early_leave_threshold_minutes ??
      params.settings.early_leave_threshold_minutes,
    overtimeThresholdMinutes:
      override.overtime_threshold_minutes ?? params.settings.overtime_threshold_minutes,
    activeServiceBlocksClockOut:
      override.active_service_blocks_clock_out ??
      params.settings.active_service_blocks_clock_out,
    source: {
      branchRuleVersionId: params.branchRuleVersionId ?? null,
      categoryRuleId: params.categoryRuleId ?? null,
    },
  };
}

export function classifyClosingClockOut(params: {
  clockOutAt: string;
  earliestNormalClockOutAt: string;
  latestNormalClockOutAt: string;
}): "early" | "normal" | "overtime" {
  const clockOut = new Date(params.clockOutAt).getTime();
  const earliest = new Date(params.earliestNormalClockOutAt).getTime();
  const latest = new Date(params.latestNormalClockOutAt).getTime();
  if (clockOut < earliest) return "early";
  if (clockOut > latest) return "overtime";
  return "normal";
}
