import { AttendanceMetricCards } from "@/components/features/attendance/overview/attendance-metric-cards";
import { AttendanceQuickActions } from "@/components/features/attendance/overview/attendance-quick-actions";
import { NeedsAttentionPanel } from "@/components/features/attendance/overview/needs-attention-panel";
import { RecentScansTable } from "@/components/features/attendance/overview/recent-scans-table";
import { StaffStatusTable } from "@/components/features/attendance/overview/staff-status-table";
import { TodayAtAGlance } from "@/components/features/attendance/overview/today-at-a-glance";
import { buildAttendanceOverviewSummary } from "@/lib/attendance/overview-summary";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceOverview({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const summary = buildAttendanceOverviewSummary(data.dailyStaffStates, data.exceptions);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(320px,1.05fr)]">
        <AttendanceMetricCards summary={summary} />
        <TodayAtAGlance summary={summary} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
        <div className="grid min-w-0 gap-4">
          <StaffStatusTable data={data} onTabChange={onTabChange} />
          <RecentScansTable data={data} onTabChange={onTabChange} />
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <NeedsAttentionPanel data={data} onTabChange={onTabChange} />
          <AttendanceQuickActions onTabChange={onTabChange} />
        </div>
      </div>
    </div>
  );
}
