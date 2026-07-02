import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusPill, formatAttendanceDateTime, humanizeAttendanceValue } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttentionExceptions({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const openExceptions = data.exceptions.filter((exception) => exception.status === "open").slice(0, 5);

  return (
    <Panel
      title={`Exceptions Requiring Action (${openExceptions.length})`}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("exceptions")}>
          View all
        </Button>
      }
    >
      {openExceptions.length === 0 ? (
        <EmptyState title="No exceptions require attention." detail="Attendance activity is currently clear." />
      ) : (
        <div className="grid gap-3">
          {openExceptions.map((exception) => (
            <div key={exception.id} className="grid gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{exception.staff_name ?? "Unassigned device"}</div>
                  <div className="text-xs text-muted-foreground">
                    {humanizeAttendanceValue(exception.exception_type)} · {formatAttendanceDateTime(exception.detected_at)}
                  </div>
                </div>
                <StatusPill value={exception.severity} tone={exception.severity === "critical" ? "bad" : "warn"} />
              </div>
              <p className="m-0 text-sm text-muted-foreground">{exception.message}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onTabChange("exceptions")}>
                  Review
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("exceptions")}>
                  Resolve
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("exceptions")}>
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
