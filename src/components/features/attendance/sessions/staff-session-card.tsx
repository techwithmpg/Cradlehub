"use client";

import { Clock3, TimerReset } from "lucide-react";
import {
  StaffAvatar,
  StatusPill,
  formatAttendanceDateTime,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceRecord, AttendanceSession } from "@/lib/attendance/types";

type ActiveStaffSession = {
  record: AttendanceRecord;
  session: AttendanceSession | undefined;
  queuePosition: number;
};

function workedMinutesSince(checkedInAt: string, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - new Date(checkedInAt).getTime()) / 60000));
}

function staffDisplayName(record: AttendanceRecord): string {
  return record.staff_nickname?.trim() || record.staff_name;
}

function shiftLabel(record: AttendanceRecord): string {
  return humanizeAttendanceValue(record.shift_type || "scheduled");
}

function attendanceTone(record: AttendanceRecord): "good" | "warn" | "bad" | "neutral" {
  if (record.exception_state === "open") return "bad";

  if (
    record.attendance_status === "late" ||
    record.attendance_status === "early_leave" ||
    record.late_minutes > 0 ||
    record.early_leave_minutes > 0
  ) {
    return "warn";
  }

  return "good";
}

export function StaffSessionCard({
  item,
  nowMs,
}: {
  item: ActiveStaffSession;
  nowMs: number;
}) {
  const record = item.record;
  const displayName = staffDisplayName(record);
  const currentTask = item.session?.service_name ?? "Available";

  return (
    <article className="w-[250px] shrink-0 snap-start rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-bold text-foreground">#{item.queuePosition}</span>
        <StatusPill value="available" tone="good" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <StaffAvatar name={displayName} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground" title={displayName}>
            {displayName}
          </h3>
          <p className="truncate text-xs capitalize text-muted-foreground">
            {humanizeAttendanceValue(record.staff_type ?? "staff")}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock3 className="size-3.5" />
            Clock In
          </span>
          <span className="font-bold text-foreground">
            {formatAttendanceDateTime(record.checked_in_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <TimerReset className="size-3.5" />
            Worked
          </span>
          <span className="font-bold text-foreground">
            {formatMinutesCompact(workedMinutesSince(record.checked_in_at, nowMs))}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Shift</span>
          <span className="font-bold text-foreground">{shiftLabel(record)}</span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Attendance</span>
          <StatusPill value={record.attendance_status} tone={attendanceTone(record)} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-muted/40 px-3 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          Current Task
        </div>
        <div className="mt-1 truncate text-sm font-bold text-foreground">
          {currentTask}
        </div>
      </div>
    </article>
  );
}
