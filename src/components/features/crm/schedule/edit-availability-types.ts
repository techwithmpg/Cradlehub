import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

export type EditAvailabilityStaffItem = StaffScheduleItem;

export type AvailabilityTab = "weekly" | "overrides" | "blocks";

export type WeeklyAvailabilityRow = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

export type ScheduleOverride = StaffScheduleItem["overrides"][number];

export type BlockedTime = StaffScheduleItem["blockedTimes"][number];
