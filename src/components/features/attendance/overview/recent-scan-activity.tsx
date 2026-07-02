import { CheckCircle2, CircleAlert, ClockArrowDown, LogOut, PlayCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusPill, formatAttendanceDateTime, humanizeAttendanceValue } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

const ACTION_ICONS = {
  clock_in: CheckCircle2,
  clock_out: LogOut,
  start_session: PlayCircle,
  activate_device: ShieldCheck,
  rejected: CircleAlert,
  exception: ClockArrowDown,
};

function getActivityIcon(action: string, outcome: string) {
  if (outcome !== "success") return CircleAlert;
  if (action.includes("clock_out")) return ACTION_ICONS.clock_out;
  if (action.includes("session")) return ACTION_ICONS.start_session;
  if (action.includes("activate")) return ACTION_ICONS.activate_device;
  return ACTION_ICONS.clock_in;
}

export function RecentScanActivity({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  return (
    <Panel
      title="Recent Scan Activity"
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("records")}>
          View all
        </Button>
      }
    >
      {data.scanEvents.length === 0 ? (
        <EmptyState title="No scans yet" detail="Recent attendance and room scans will appear here." />
      ) : (
        <div className="grid gap-3">
          {data.scanEvents.slice(0, 10).map((event) => {
            const Icon = getActivityIcon(event.action, event.outcome);
            return (
              <div key={event.id} className="grid grid-cols-[28px_1fr_auto] gap-3">
                <span className="flex size-7 items-center justify-center rounded-full border border-emerald-800/20 text-emerald-800">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{event.staff_name ?? event.point_label ?? "Unknown device"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {humanizeAttendanceValue(event.action)} · {event.message ?? event.reason_code ?? "Recorded"}
                  </div>
                </div>
                <div className="grid justify-items-end gap-1 text-right">
                  <span className="text-xs text-muted-foreground">{formatAttendanceDateTime(event.created_at)}</span>
                  <StatusPill value={event.outcome} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
