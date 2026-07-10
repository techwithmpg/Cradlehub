import { Button } from "@/components/ui/button";
import { EmptyState, Panel, RemainingProgress, StatusPill, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

function remainingMinutes(dueAt: string | null, nowMs: number): number {
  if (!dueAt) return 0;
  return Math.round((new Date(dueAt).getTime() - nowMs) / 60000);
}

function sessionState(session: AttendanceWorkspaceData["sessions"][number], nowMs: number): string {
  if (session.booking_progress_status !== "session_started") return session.booking_progress_status;
  const remaining = remainingMinutes(session.session_due_at, nowMs);
  if (remaining < 0) return "overdue";
  if (remaining <= 10) return "ending_soon";
  return "active";
}

export function ActiveServiceSessions({
  data,
  nowMs,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const activeSessions = data.sessions.filter((session) => session.booking_progress_status === "session_started").slice(0, 8);

  return (
    <Panel
      title={`Active Service Sessions (${activeSessions.length})`}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("sessions")}>
          View all
        </Button>
      }
    >
      {activeSessions.length === 0 ? (
        <EmptyState title="No active sessions" detail="Room scans will start service countdowns here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Room</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Therapist</th>
                <th className="px-3 py-2 font-semibold">Service</th>
                <th className="px-3 py-2 font-semibold">Remaining</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map((session) => (
                <tr key={session.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-semibold">{session.resource_name ?? "Unassigned"}</td>
                  <td className="px-3 py-3">{session.customer_name}</td>
                  <td className="px-3 py-3">{session.staff_name}</td>
                  <td className="px-3 py-3">{session.service_name}</td>
                  <td className="px-3 py-3">
                    <RemainingProgress
                      remainingMinutes={remainingMinutes(session.session_due_at, nowMs)}
                      totalMinutes={session.duration_minutes ?? 60}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill value={sessionState(session, nowMs)} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      Started {formatAttendanceDateTime(session.session_started_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
