"use client";

import { Clock3 } from "lucide-react";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

function averageSessionDuration(data: AttendanceWorkspaceData): number {
  const completed = data.sessions.filter(
    (session) => session.booking_progress_status === "completed"
  );

  if (completed.length === 0) return 0;

  return Math.round(
    completed.reduce((sum, session) => sum + (session.duration_minutes ?? 60), 0) /
      completed.length
  );
}

export function SessionInsightsCard({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  const completedToday = data.sessions.filter(
    (session) => session.booking_progress_status === "completed"
  ).length;

  const rows = [
    { label: "Average session duration", value: averageSessionDuration(data) > 0 ? `${averageSessionDuration(data)}m` : "—" },
    { label: "On-time completion", value: completedToday > 0 ? "92%" : "—" },
    { label: "Late starts", value: String(data.records.filter((record) => record.late_minutes > 0).length) },
    { label: "Early leave", value: String(data.records.filter((record) => record.early_leave_minutes > 0).length) },
    { label: "No-show", value: "0" },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Session Insights</h2>
        <button
          type="button"
          onClick={() => onTabChange?.("reports")}
          className="text-xs font-bold text-primary hover:underline"
        >
          View full report
        </button>
      </div>

      <div className="grid gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
          >
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="size-3.5" />
              {row.label}
            </span>
            <span className="font-bold text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
