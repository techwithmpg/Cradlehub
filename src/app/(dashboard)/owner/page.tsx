import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/features/owner/dashboard/owner-dashboard";
import {
  getOwnerOverviewDashboardData,
  OwnerDashboardAccessError,
} from "@/lib/queries/owner-dashboard";
import {
  createAttendanceScanFeedFallback,
  getRecentAttendanceScanFeed,
} from "@/lib/attendance/recent-scans";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

export const dynamic = "force-dynamic";

export default async function OwnerOverviewPage() {
  const data = await loadOwnerOverviewDashboardData();
  const attendanceScanFeed = await getRecentAttendanceScanFeed({
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

  return (
    <RetainedWorkspaceModule moduleId="owner-overview">
      <OwnerDashboard data={data} attendanceScanFeed={attendanceScanFeed} />
    </RetainedWorkspaceModule>
  );
}

async function loadOwnerOverviewDashboardData() {
  try {
    return await getOwnerOverviewDashboardData();
  } catch (error) {
    if (error instanceof OwnerDashboardAccessError) {
      redirect(error.destination);
    }
    throw error;
  }
}
