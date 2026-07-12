import { ActiveServiceSessions } from "@/components/features/attendance/overview/active-service-sessions";
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
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(390px,0.9fr)]">
      <div className="grid gap-4">
        <LiveStaffTable data={data} nowMs={nowMs} />
        <ActiveServiceSessions data={data} nowMs={nowMs} onTabChange={onTabChange} />
      </div>

      <div className="grid content-start gap-4">
        <RecentScanActivity data={data} onTabChange={onTabChange} />
        <AttentionExceptions data={data} onTabChange={onTabChange} />
      </div>
    </div>
  );
}

