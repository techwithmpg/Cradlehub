"use client";

import { useMemo, useState, useTransition } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel, RemainingProgress, StaffAvatar, StatusPill, formatAttendanceDateTime, formatMinutesCompact } from "@/components/features/attendance/attendance-ui";
import { completeDueServiceSessionsAction, type AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceRecord, AttendanceSession, AttendanceWorkspaceData } from "@/lib/attendance/types";

function remainingMinutes(dueAt: string | null): number {
  if (!dueAt) return 0;
  return Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
}

function sessionState(session: AttendanceSession): string {
  if (session.booking_progress_status !== "session_started") return session.booking_progress_status;
  const remaining = remainingMinutes(session.session_due_at);
  if (remaining < 0) return "overdue";
  if (remaining <= 10) return "ending_soon";
  return "active";
}

function activeServiceForStaff(sessions: AttendanceSession[], staffId: string): AttendanceSession | undefined {
  return sessions.find((session) => session.booking_progress_status === "session_started" && session.staff_id === staffId);
}

function attendanceAvailabilityState(record: AttendanceRecord, activeService?: AttendanceSession): string {
  if (record.status === "checked_out" || record.checked_out_at) return "clocked_out";
  if (activeService) return "in_service";
  if (record.status === "checked_in") return "available";
  return "not_arrived";
}

function displayStaffName(record: AttendanceRecord): string {
  return record.staff_nickname ?? record.staff_name;
}

function displayRole(record: AttendanceRecord): string {
  return record.staff_type ?? record.system_role ?? "staff";
}

function workedMinutesSince(checkedInAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(checkedInAt).getTime()) / 60000));
}

export function ServiceSessionsTab({
  data,
  onActionResult,
}: {
  data: AttendanceWorkspaceData;
  onActionResult: (result: AttendanceActionResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeAttendanceSessions = useMemo<AttendanceRecord[]>(() => {
    const checkedIn = data.records
      .filter((record) => record.status === "checked_in" && !record.checked_out_at)
      .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime());
    return checkedIn;
  }, [data.records]);

  const serviceRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.sessions.filter((session) => {
      const haystack = `${session.customer_name} ${session.staff_name} ${session.service_name} ${session.resource_name ?? ""}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesStatus = status === "all" || session.booking_progress_status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data.sessions, query, status]);

  function completeDue() {
    startTransition(async () => {
      onActionResult(await completeDueServiceSessionsAction());
    });
  }

  return (
    <div className="grid gap-4">
      <Panel title={`Active Attendance Sessions (${activeAttendanceSessions.length})`}>
        {activeAttendanceSessions.length === 0 ? (
          <EmptyState
            title="No active attendance sessions"
            detail="Staff who clock in at the attendance QR will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {["Queue", "Staff", "Clock In", "Worked", "Shift", "Status", "Attendance", "Current Task"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeAttendanceSessions.map((record, index) => {
                  const queuePosition = index + 1;
                  const service = activeServiceForStaff(data.sessions, record.staff_id);
                  const availability = attendanceAvailabilityState(record, service);
                  return (
                    <tr key={record.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 font-semibold">#{queuePosition}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <StaffAvatar name={record.staff_name} />
                          <div>
                            <div className="font-semibold">{displayStaffName(record)}</div>
                            <div className="text-xs capitalize text-muted-foreground">{displayRole(record)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatAttendanceDateTime(record.checked_in_at)}</td>
                      <td className="px-3 py-3">{formatMinutesCompact(workedMinutesSince(record.checked_in_at))}</td>
                      <td className="px-3 py-3 capitalize">{record.shift_type}</td>
                      <td className="px-3 py-3"><StatusPill value={availability} /></td>
                      <td className="px-3 py-3"><StatusPill value={record.attendance_status} /></td>
                      <td className="px-3 py-3">
                        {service ? (
                          <span>
                            <strong>{service.resource_name ?? "Room"}</strong>
                            <span className="text-muted-foreground"> · {service.service_name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Service Session Management"
        action={
          <Button type="button" variant="outline" disabled={isPending} onClick={completeDue}>
            <RefreshCw data-icon="inline-start" />
            {isPending ? "Checking..." : "Complete Due"}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
            <option>{data.branchName}</option>
          </select>
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
            <option>Today</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
          >
            <option value="all">All statuses</option>
            <option value="session_started">Active</option>
            <option value="completed">Completed</option>
          </select>
          <label className="flex h-8 min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
      </Panel>

      <Panel title={`Service Sessions (${serviceRows.length})`}>
        {serviceRows.length === 0 ? (
          <EmptyState title="No service sessions found." detail="Room QR scans will appear here once services start." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {["Customer", "Therapist", "Room", "Service", "Started", "Expected End", "Actual End", "Remaining", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((session) => (
                  <tr key={session.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-semibold">{session.customer_name}</td>
                    <td className="px-3 py-3">{session.staff_name}</td>
                    <td className="px-3 py-3">{session.resource_name ?? "Unassigned"}</td>
                    <td className="px-3 py-3">{session.service_name}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(session.session_started_at)}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(session.session_due_at)}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(session.session_completed_at)}</td>
                    <td className="px-3 py-3"><RemainingProgress remainingMinutes={remainingMinutes(session.session_due_at)} totalMinutes={session.duration_minutes ?? 60} /></td>
                    <td className="px-3 py-3"><StatusPill value={sessionState(session)} /></td>
                    <td className="px-3 py-3"><Button type="button" variant="outline" size="sm" onClick={() => setSelectedSession(session)}>Open Countdown</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={selectedSession !== null} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSession?.customer_name ?? "Session"}</DialogTitle>
            <DialogDescription>Service countdown and scan evidence stay attached to the booking session.</DialogDescription>
          </DialogHeader>
          {selectedSession ? (
            <div className="grid gap-3 text-sm">
              <StatusPill value={sessionState(selectedSession)} />
              <div>{selectedSession.service_name} · {selectedSession.staff_name}</div>
              <div className="text-muted-foreground">{selectedSession.resource_name ?? "No room assigned"}</div>
              <RemainingProgress remainingMinutes={remainingMinutes(selectedSession.session_due_at)} totalMinutes={selectedSession.duration_minutes ?? 60} />
            </div>
          ) : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
