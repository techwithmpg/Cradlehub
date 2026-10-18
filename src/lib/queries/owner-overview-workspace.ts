import "server-only";

import {
  createAttendanceScanFeedFallback,
  getRecentAttendanceScanFeed,
} from "@/lib/attendance/recent-scans";
import {
  getOwnerOverviewDashboardData,
  type OwnerOverviewDashboardData,
} from "@/lib/queries/owner-dashboard";
import type { OwnerOverviewWorkspacePayload } from "@/components/features/owner/dashboard/owner-overview-workspace-data";

async function loadAttendanceFeed(
  data: OwnerOverviewDashboardData
) {
  return getRecentAttendanceScanFeed({
    workspace: "owner",
    selectedDate: data.today,
    maxItems: 5,
  }).catch(() =>
    createAttendanceScanFeedFallback({
      workspace: "owner",
      selectedDate: data.today,
      error: "Attendance activity could not be refreshed.",
    })
  );
}

export async function loadOwnerOverviewWorkspaceData(): Promise<OwnerOverviewWorkspacePayload> {
  const data = await getOwnerOverviewDashboardData();
  const attendanceScanFeed = await loadAttendanceFeed(data);

  return {
    data,
    attendanceScanFeed,
  };
}
