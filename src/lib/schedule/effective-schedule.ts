import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

export type EffectiveScheduleSource =
  | "individual_custom"
  | "group_default"
  | "no_schedule"
  | "override_day_off"
  | "blocked";

export type StaffScheduleSourceInfo = {
  source: EffectiveScheduleSource;
  label: string;
  color: string;
  bg: string;
};

const SOURCE_INFO: Record<EffectiveScheduleSource, StaffScheduleSourceInfo> = {
  individual_custom: {
    source: "individual_custom",
    label: "Custom",
    color: "var(--cs-sand-dark)",
    bg: "var(--cs-sand-mist)",
  },
  group_default: {
    source: "group_default",
    label: "Group Default",
    color: "var(--cs-success)",
    bg: "var(--cs-success-bg)",
  },
  no_schedule: {
    source: "no_schedule",
    label: "No Schedule",
    color: "var(--cs-neutral)",
    bg: "var(--cs-neutral-bg)",
  },
  override_day_off: {
    source: "override_day_off",
    label: "Day Off",
    color: "var(--cs-error)",
    bg: "var(--cs-error-bg)",
  },
  blocked: {
    source: "blocked",
    label: "Blocked",
    color: "var(--cs-warning)",
    bg: "var(--cs-warning-bg)",
  },
};

/**
 * Determine where a staff member's schedule comes from.
 *
 * Priority:
 * 1. Individual staff_schedules → "individual_custom"
 * 2. Group schedule rules → "group_default"
 * 3. No schedule → "no_schedule"
 *
 * Note: This is a setup-time classification, not a runtime availability check.
 * Date overrides, blocked times, check-ins, and bookings are evaluated separately.
 */
export function getStaffScheduleSource(
  item: StaffScheduleItem,
  groupRules: StaffGroupScheduleRule[]
): StaffScheduleSourceInfo {
  const hasIndividualSchedule = item.schedules.some((s) => s.is_active);

  if (hasIndividualSchedule) {
    return SOURCE_INFO.individual_custom;
  }

  const hasGroupRules = groupRules.some((r) => r.is_active && !r.is_day_off);

  if (hasGroupRules) {
    return SOURCE_INFO.group_default;
  }

  return SOURCE_INFO.no_schedule;
}

/**
 * Get the schedule source info for display purposes.
 */
export function getScheduleSourceInfo(source: EffectiveScheduleSource): StaffScheduleSourceInfo {
  return SOURCE_INFO[source];
}
