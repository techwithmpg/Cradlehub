import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { OwnerOverviewDashboardData } from "@/lib/queries/owner-dashboard";

export type OwnerOverviewWorkspacePayload = {
  data: OwnerOverviewDashboardData;
  attendanceScanFeed: AttendanceScanFeedData;
};

export const OWNER_OVERVIEW_REQUEST_KEY = "/owner";
