"use client";

import { History } from "lucide-react";
import {
  EmptyState,
  StatusPill,
  formatAttendanceDate,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

export function RecoveryAuditLogPanel({ data }: { data: AttendanceWorkspaceData }) {
  return (
    <section className="rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrections, device recovery actions, rule changes, and review history.
          </p>
        </div>
        <History className="size-5 text-muted-foreground" />
      </div>

      <div className="grid gap-3 p-4">
        {data.corrections.length === 0 ? (
          <EmptyState
            title="No attendance corrections yet"
            detail="Applied corrections and rule changes will appear here."
          />
        ) : (
          data.corrections.map((correction) => (
            <div key={correction.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-foreground">
                    {humanizeAttendanceValue(correction.action_type)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {correction.staff_name ?? data.branchName} ·{" "}
                    {formatAttendanceDateTime(correction.corrected_at ?? correction.created_at)}
                  </div>
                </div>
                <StatusPill value={correction.status} />
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {correction.reason}
              </p>

              {correction.attendance_date ? (
                <div className="mt-2 text-xs font-bold text-muted-foreground">
                  Attendance date: {formatAttendanceDate(correction.attendance_date)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
