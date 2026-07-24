"use client";

import Link from "next/link";
import { Bell, RefreshCw } from "lucide-react";
import { AttendanceScanFeedRow } from "@/components/features/attendance/attendance-scan-feed-row";
import { useAttendanceScanFeed } from "@/components/features/attendance/use-attendance-scan-feed";
import {
  buildAttendanceViewAllHref,
  formatAttendanceFeedDateLabel,
} from "@/lib/attendance/scan-feed";
import { cn } from "@/lib/utils";
import type {
  AttendanceScanFeedData,
  AttendanceScanFeedWorkspace,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

type AttendanceScanFeedCardProps = {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId?: string | null;
  branchName?: string | null;
  feed: AttendanceScanFeedData;
  maxItems?: number;
  className?: string;
  onScanSelect?: (scan: RecentAttendanceScan) => void;
};

const REFRESH_ERROR = "Attendance activity could not be refreshed.";

export function AttendanceScanFeedCard({
  workspace,
  selectedDate,
  branchId,
  branchName,
  feed,
  maxItems = 5,
  className,
  onScanSelect,
}: AttendanceScanFeedCardProps) {
  const resolvedBranchId = branchId ?? feed.branchId;
  const resolvedBranchName = branchName ?? feed.branchName;
  const {
    feed: visibleFeed,
    error: refreshError,
    isValidating,
    refreshFeed,
  } = useAttendanceScanFeed({
    workspace,
    selectedDate,
    branchId: resolvedBranchId,
    initialFeed: feed,
    maxItems,
  });
  const displayError = visibleFeed.error ?? (refreshError ? REFRESH_ERROR : null);
  const dateLabel = formatAttendanceFeedDateLabel(visibleFeed.selectedDate, visibleFeed.timezone);
  const viewAllHref = buildAttendanceViewAllHref({
    workspace,
    selectedDate,
    branchId: resolvedBranchId,
  });

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-sm",
        className
      )}
      aria-label="Recent attendance scans"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-[#9b7336]" aria-hidden="true" />
            <h2 className="truncate text-sm font-bold text-[var(--cs-text)]">
              Attendance Activity
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              Live
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--cs-text-muted)]">
            {resolvedBranchName ?? "All branches"} - {dateLabel}
          </p>
        </div>
        <Link
          href={viewAllHref}
          prefetch={false}
          className="shrink-0 text-xs font-bold text-[#7c5727] hover:text-[#0b3b27]"
        >
          View all
        </Link>
      </header>

      {displayError && visibleFeed.items.length === 0 ? (
        <div className="grid gap-3 px-4 py-4 text-sm text-[var(--cs-text-muted)]">
          <p>{REFRESH_ERROR}</p>
          <button
            type="button"
            onClick={refreshFeed}
            className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-[var(--cs-border)] px-3 text-xs font-bold text-[var(--cs-text)]"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : visibleFeed.items.length === 0 ? (
        <div className="px-4 py-5 text-sm text-[var(--cs-text-muted)]">
          No attendance scans yet today.
        </div>
      ) : (
        <div className="divide-y divide-[var(--cs-border-soft)] px-3 py-2">
          {visibleFeed.items.slice(0, maxItems).map((scan) => (
            <AttendanceScanFeedRow
              key={scan.eventId}
              scan={scan}
              workspace={workspace}
              selectedDate={selectedDate}
              onSelect={onScanSelect}
            />
          ))}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] px-4 py-2 text-xs text-[var(--cs-text-muted)]">
        <span>
          {visibleFeed.lastHourCount.toLocaleString("en-PH")}{" "}
          {visibleFeed.lastHourCount === 1 ? "scan" : "scans"} in the last hour
        </span>
        {isValidating ? <span>Refreshing</span> : null}
      </footer>
    </section>
  );
}
