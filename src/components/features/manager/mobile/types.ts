import type { TodayBooking, StaffAvailability } from "@/components/features/manager-today/manager-today-utils";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

export type MobileTab = "today" | "schedule" | "bookings" | "staff" | "approvals" | "more";

export type MobileManagerData = {
  branchName: string;
  todayLabel: string;
  bookings: TodayBooking[];
  staff: StaffAvailability[];
  scheduleRows: DailyScheduleStaffRow[];
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  userRole: string;
};

export type StatusFilter = "all" | "pending" | "confirmed" | "changes" | "problem";
export type StaffSegment = "active" | "pending" | "offduty";
