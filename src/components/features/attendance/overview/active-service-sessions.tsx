import { ArrowRight, Clock3, DoorOpen, TimerReset, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RemainingProgress,
  StatusPill,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

function remainingMinutes(dueAt: string | null, nowMs: number): number {
  if (!dueAt) return 0;
  return Math.round((new Date(dueAt).getTime() - nowMs) / 60000);
}

function sessionState(
  session: AttendanceWorkspaceData["sessions"][number],
  nowMs: number
): "active" | "ending_soon" | "overdue" | string {
  if (session.booking_progress_status !== "session_started") {
    return session.booking_progress_status;
  }

  const remaining = remainingMinutes(session.session_due_at, nowMs);
  if (remaining < 0) return "overdue";
  if (remaining <= 10) return "ending_soon";
  return "active";
}

function startedLabel(value: string | null): string {
  if (!value) return "Start time unknown";
  return `Started ${formatAttendanceDateTime(value)}`;
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
  const activeSessions = data.sessions
    .filter((session) => session.booking_progress_status === "session_started")
    .slice(0, 4);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-stone-50/60 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Active Service Sessions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Room countdowns and in-progress treatments.
          </p>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("sessions")}>
          View all
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </div>

      {activeSessions.length === 0 ? (
        <div className="flex min-h-[118px] items-center justify-center px-4 py-5">
          <div className="flex max-w-md items-center gap-3 rounded-2xl border border-dashed border-border bg-stone-50 px-4 py-4 text-sm text-muted-foreground">
            <DoorOpen className="size-5 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">No active room sessions</div>
              <div className="text-xs">
                Room QR scans will appear here once a service countdown starts.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-3 md:grid-cols-2">
          {activeSessions.map((session) => {
            const remaining = remainingMinutes(session.session_due_at, nowMs);
            const totalMinutes = session.duration_minutes ?? 60;

            return (
              <div
                key={session.id}
                className="rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:border-emerald-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="size-4 text-emerald-800" />
                      <div className="truncate text-sm font-bold text-foreground">
                        {session.resource_name ?? "Unassigned room"}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {session.service_name}
                    </div>
                  </div>

                  <StatusPill value={sessionState(session, nowMs)} />
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <UserRound className="size-3.5" />
                      Customer
                    </span>
                    <span className="truncate font-semibold text-foreground">
                      {session.customer_name}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <TimerReset className="size-3.5" />
                      Therapist
                    </span>
                    <span className="truncate font-semibold text-foreground">
                      {session.staff_name}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <RemainingProgress
                    remainingMinutes={remaining}
                    totalMinutes={totalMinutes}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Clock3 className="size-3.5 shrink-0" />
                    <span className="truncate">{startedLabel(session.session_started_at)}</span>
                  </span>

                  <span className="shrink-0 font-bold text-foreground">
                    {remaining < 0 ? `${Math.abs(remaining)}m over` : `${remaining}m left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
