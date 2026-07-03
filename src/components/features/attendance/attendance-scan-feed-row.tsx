"use client";

import Link from "next/link";
import { ChevronRight, Clock3 } from "lucide-react";
import {
  buildAttendanceRecordHref,
  formatAttendanceScanTime,
  formatShiftTypeLabel,
  getAttendanceScanBadge,
  getAttendanceScanEventLabel,
  getAttendanceScanInitials,
} from "@/lib/attendance/scan-feed";
import { cn } from "@/lib/utils";
import type {
  AttendanceScanFeedWorkspace,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

export function AttendanceScanFeedRow({
  scan,
  workspace,
  selectedDate,
}: {
  scan: RecentAttendanceScan;
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
}) {
  const badge = getAttendanceScanBadge(scan);
  const displayName = scan.staffNickname || scan.staffName;
  const href = buildAttendanceRecordHref({
    workspace,
    selectedDate,
    staffId: scan.staffId,
    branchId: scan.branchId,
  });

  return (
    <Link
      href={href}
      prefetch={false}
      className="grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-2 text-sm transition hover:bg-[#f7eddd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78a42]/35"
      aria-label={`Open ${scan.staffName} attendance record`}
    >
      <span
        className="flex size-8 items-center justify-center rounded-full bg-[#efe4c4] bg-cover bg-center text-xs font-bold text-[#7c5727]"
        style={
          scan.staffAvatarUrl
            ? { backgroundImage: `url("${scan.staffAvatarUrl}")` }
            : undefined
        }
        aria-hidden="true"
      >
        {scan.staffAvatarUrl ? null : getAttendanceScanInitials(displayName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-[var(--cs-text)]">
          {displayName}
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--cs-text-muted)]">
          <Clock3 className="size-3" aria-hidden="true" />
          <span>{getAttendanceScanEventLabel(scan)}</span>
          <span>{formatAttendanceScanTime(scan.occurredAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--cs-text-muted)]">
          {formatShiftTypeLabel(scan.shiftType)}
          {scan.branchName ? ` - ${scan.branchName}` : ""}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold",
            badge.tone === "good" && "bg-emerald-100 text-emerald-800",
            badge.tone === "warn" && "bg-amber-100 text-amber-800",
            badge.tone === "info" && "bg-blue-100 text-blue-800"
          )}
        >
          {badge.label}
        </span>
        <ChevronRight className="size-4 text-[var(--cs-text-muted)]" aria-hidden="true" />
      </span>
    </Link>
  );
}
