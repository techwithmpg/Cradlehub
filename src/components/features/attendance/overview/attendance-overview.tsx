import { ActiveServiceSessions } from "@/components/features/attendance/overview/active-service-sessions";
import { AttendanceQuickActions } from "@/components/features/attendance/overview/attendance-quick-actions";
import { AttentionExceptions } from "@/components/features/attendance/overview/attention-exceptions";
import { LiveStaffTable } from "@/components/features/attendance/overview/live-staff-table";
import { RecentScanActivity } from "@/components/features/attendance/overview/recent-scan-activity";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceOverview({
  data,
  nowMs,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <LiveStaffTable data={data} nowMs={nowMs} />
        <RecentScanActivity data={data} onTabChange={onTabChange} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <ActiveServiceSessions data={data} nowMs={nowMs} onTabChange={onTabChange} />
        <AttentionExceptions data={data} onTabChange={onTabChange} />
      </div>
      <AttendanceQuickActions onTabChange={onTabChange} />
    </div>
  );
}
