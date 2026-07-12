import {
  CheckCircle2,
  CircleAlert,
  ClockArrowDown,
  LogOut,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Panel,
  StatusPill,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
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

function iconTone(outcome: string): string {
  if (outcome === "success") return "bg-emerald-100 text-emerald-800";
  if (outcome === "blocked" || outcome === "error") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

export function RecentScanActivity({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const events = data.scanEvents.slice(0, 8);

  return (
    <Panel
      title="Recent Scan Activity"
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("records")}>
          View all
        </Button>
      }
      className="rounded-2xl"
    >
      {events.length === 0 ? (
        <EmptyState title="No scans yet" detail="Attendance and room scans will appear here." />
      ) : (
        <div className="relative grid gap-0">
          {events.map((event, index) => {
            const Icon = getActivityIcon(event.action, event.outcome);
            return (
              <div key={event.id} className="grid grid-cols-[70px_24px_1fr_auto] gap-3">
                <div className="pt-1 text-right text-xs text-muted-foreground">
                  {formatAttendanceDateTime(event.created_at)}
                </div>
                <div className="relative grid justify-items-center">
                  {index !== events.length - 1 ? (
                    <span className="absolute top-7 h-[calc(100%-10px)] w-px bg-border" />
                  ) : null}
                  <span
                    className={`relative z-10 flex size-6 items-center justify-center rounded-full ${iconTone(
                      event.outcome
                    )}`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </div>
                <div className="min-w-0 pb-4">
                  <div className="truncate text-sm font-bold">
                    {event.staff_name ?? event.point_label ?? "Unknown device"}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {humanizeAttendanceValue(event.action)} ·{" "}
                    {event.message ?? event.reason_code ?? "Recorded"}
                  </div>
                </div>
                <div className="pb-4">
                  <StatusPill
                    value={event.outcome}
                    tone={
                      event.outcome === "success"
                        ? "good"
                        : event.outcome === "blocked" || event.outcome === "error"
                          ? "bad"
                          : "warn"
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
