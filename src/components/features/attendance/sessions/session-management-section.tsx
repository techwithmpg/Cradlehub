"use client";

import { useState, useTransition } from "react";
import { DoorOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  RemainingProgress,
  StaffAvatar,
  StatusPill,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import {
  completeDueServiceSessionsAction,
  type AttendanceActionResult,
} from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceSession, AttendanceWorkspaceData } from "@/lib/attendance/types";

function remainingMinutes(dueAt: string | null, nowMs: number): number {
  if (!dueAt) return 0;
  return Math.round((new Date(dueAt).getTime() - nowMs) / 60000);
}

function sessionStatus(
  session: AttendanceSession,
  nowMs: number
): "in_progress" | "ending_soon" | "completed" | "cancelled" | "scheduled" {
  if (session.booking_progress_status === "completed") return "completed";
  if (session.booking_progress_status === "cancelled") return "cancelled";

  if (session.booking_progress_status === "session_started") {
    const remaining = remainingMinutes(session.session_due_at, nowMs);
    return remaining <= 15 ? "ending_soon" : "in_progress";
  }

  return "scheduled";
}

function visibleSessionStatusLabel(session: AttendanceSession, nowMs: number): string {
  const status = sessionStatus(session, nowMs);

  if (status === "ending_soon") return "Ending Soon";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  return "Scheduled";
}

function visibleSessionStatusTone(
  session: AttendanceSession,
  nowMs: number
): "good" | "warn" | "bad" | "neutral" {
  const status = sessionStatus(session, nowMs);

  if (status === "ending_soon") return "warn";
  if (status === "cancelled") return "bad";
  if (status === "completed" || status === "in_progress") return "good";

  return "neutral";
}

function SessionTableRow({
  session,
  nowMs,
}: {
  session: AttendanceSession;
  nowMs: number;
}) {
  const remaining = remainingMinutes(session.session_due_at, nowMs);
  const totalMinutes = session.duration_minutes ?? 60;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="whitespace-nowrap px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <StaffAvatar name={session.customer_name ?? "Customer"} />
          <div className="min-w-0">
            <div className="max-w-[130px] truncate text-sm font-bold text-foreground">
              {session.customer_name ?? "Unknown customer"}
            </div>
            <div className="text-xs text-muted-foreground">Customer</div>
          </div>
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="max-w-[120px] truncate text-sm font-semibold text-foreground">
          {session.staff_name ?? "Unassigned"}
        </div>
      </td>

      <td className="px-3 py-3">
        <span className="inline-flex max-w-[120px] items-center gap-1.5 rounded-full bg-muted/40 px-2 py-1 text-xs font-bold text-foreground">
          <DoorOpen className="size-3.5 shrink-0" />
          <span className="truncate">{session.resource_name ?? "No room"}</span>
        </span>
      </td>

      <td className="px-3 py-3">
        <div className="max-w-[160px] truncate text-sm font-semibold text-foreground">
          {session.service_name ?? "Service"}
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-3">
        <div className="text-sm font-semibold text-foreground">
          {formatAttendanceDateTime(session.session_started_at)}
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-3">
        <div className="text-sm font-semibold text-foreground">
          {formatAttendanceDateTime(session.session_due_at)}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="min-w-[95px]">
          <div className="text-sm font-bold text-foreground">
            {remaining < 0 ? `${Math.abs(remaining)}m over` : `${Math.max(0, remaining)}m`}
          </div>
          <RemainingProgress remainingMinutes={remaining} totalMinutes={totalMinutes} />
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-3">
        <StatusPill
          value={visibleSessionStatusLabel(session, nowMs)}
          tone={visibleSessionStatusTone(session, nowMs)}
        />
      </td>

      <td className="whitespace-nowrap px-3 py-3 text-right">
        <Button type="button" variant="outline" size="sm" disabled>
          Open Countdown
        </Button>
      </td>
    </tr>
  );
}

export function ServiceSessionManagementSection({
  data,
  nowMs,
  onActionResult,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onActionResult?: (result: AttendanceActionResult) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const sessions = data.sessions;
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(sessions.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * pageSize;
  const visibleSessions = sessions.slice(pageStart, pageStart + pageSize);

  function completeDue() {
    if (!onActionResult) return;

    startTransition(async () => {
      onActionResult(await completeDueServiceSessionsAction());
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Service Session Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage ongoing and upcoming service bookings.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={isPending || !onActionResult}
          onClick={completeDue}
        >
          <RefreshCw className="mr-2 size-4" />
          {isPending ? "Checking..." : "Complete Due"}
        </Button>
      </div>

      <div className="overflow-x-auto px-4 py-4">
        {sessions.length === 0 ? (
          <EmptyState
            title="No service sessions found"
            detail="Service countdowns will appear here after room or service scans."
          />
        ) : (
          <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-muted/30 text-xs font-bold text-muted-foreground">
                <th className="rounded-l-xl px-3 py-3">Customer</th>
                <th className="px-3 py-3">Therapist</th>
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Started</th>
                <th className="px-3 py-3">Expected End</th>
                <th className="px-3 py-3">Remaining</th>
                <th className="px-3 py-3">Status</th>
                <th className="rounded-r-xl px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleSessions.map((session) => (
                <SessionTableRow key={session.id} session={session} nowMs={nowMs} />
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {sessions.length === 0 ? 0 : pageStart + 1} to{" "}
            {Math.min(pageStart + visibleSessions.length, sessions.length)} of {sessions.length} sessions
          </span>

          {pageCount > 1 ? (
            <div className="flex items-center gap-2" aria-label="Service session pages">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show sessions page ${index + 1}`}
                  aria-current={index === currentPage ? "page" : undefined}
                  onClick={() => setPage(index)}
                  className={`inline-flex size-8 items-center justify-center rounded-xl border font-bold ${
                    index === currentPage
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
