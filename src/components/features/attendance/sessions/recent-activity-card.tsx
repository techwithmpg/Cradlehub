"use client";

import { UserRound } from "lucide-react";
import {
  EmptyState,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceRecord, AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

function staffName(record: AttendanceRecord): string {
  return record.staff_nickname?.trim() || record.staff_name;
}

function shiftLabel(record: AttendanceRecord): string {
  return humanizeAttendanceValue(record.shift_type || "scheduled");
}

export function RecentActivityCard({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  const records = data.records
    .filter((record) => record.checked_in_at)
    .sort(
      (a, b) =>
        new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()
    )
    .slice(0, 6);

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Recent Activity</h2>
        <button
          type="button"
          onClick={() => onTabChange?.("records")}
          className="text-xs font-bold text-primary hover:underline"
        >
          View all
        </button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No recent activity"
          detail="Clock-ins and session changes will appear here."
        />
      ) : (
        <div className="relative grid gap-0">
          {records.map((record, index) => (
            <div key={record.id} className="grid grid-cols-[58px_24px_1fr] gap-3">
              <div className="pt-1 text-right text-xs leading-tight text-muted-foreground">
                {formatAttendanceDateTime(record.checked_in_at)}
              </div>

              <div className="relative grid justify-items-center">
                {index !== records.length - 1 ? (
                  <span className="absolute top-7 h-[calc(100%-8px)] w-px bg-border" />
                ) : null}

                <span className="relative z-10 flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="size-3.5" />
                </span>
              </div>

              <div className="min-w-0 pb-4">
                <div className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                  {staffName(record)} clocked in
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {shiftLabel(record)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
