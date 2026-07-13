import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import type {
  DatabaseScheduleShiftType,
  ScheduleDayMode,
  ScheduleShiftKind,
} from "@/lib/schedule/schedule-domain";

export type { DatabaseScheduleShiftType, ScheduleDayMode, ScheduleShiftKind };
export type AdjustScheduleMode = "weekly" | "date" | "blocked" | "exceptions";

export type ScheduleWindowDraft = {
  id: string;
  persistedId?: string;
  shiftKind: ScheduleShiftKind;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  order: number;
};

export type WeeklyScheduleDayDraft = {
  dayOfWeek: number;
  mode: ScheduleDayMode;
  windows: ScheduleWindowDraft[];
};

export type AdjustScheduleDraft = {
  staffId: string;
  branchId: string;
  days: WeeklyScheduleDayDraft[];
};

export type AdjustScheduleTarget = {
  staffId: string;
  branchId: string;
  initialMode?: AdjustScheduleMode;
};

export type ScheduleValidationIssue = {
  id: string;
  level: "error" | "warning" | "info";
  message: string;
  dayOfWeek?: number;
};

export type AdjustScheduleStaffItem = StaffScheduleItem;
