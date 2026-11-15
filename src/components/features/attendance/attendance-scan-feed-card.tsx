"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, RefreshCw } from "lucide-react";
import { AttendanceScanFeedRow } from "@/components/features/attendance/attendance-scan-feed-row";
import { useAttendanceScanFeed } from "@/components/features/attendance/use-attendance-scan-feed";
import type { AttendanceRealtimeStatus } from "@/components/features/attendance/use-attendance-scan-realtime";
import { CrmSectionCard } from "@/components/features/crm/shared/crm-cards";
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

type AttendanceScanFeedPanelProps = AttendanceScanFeedCardProps & {
  realtimeStatus: AttendanceRealtimeStatus;
  isValidating: boolean;
  refreshError: string | null;
  onRefresh: () => void;
};

const REFRESH_ERROR = "Attendance activity could not be refreshed.";

const statusPresentation: Record<AttendanceRealtimeStatus, { label: string; className: string }> = {
  connecting: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-800",
  },
  live: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-800",
  },
  delayed: {
    label: "Delayed",
    className: "bg-amber-100 text-amber-800",
  },
  offline: {
    label: "Offline",
    className: "bg-stone-200 text-stone-700",
  },
};

const EMPTY_SUBSCRIBE = () => () => {};

export function AttendanceScanFeedPanel({
  workspace,
  selectedDate,
  branchId,
  branchName,
  feed,
  maxItems = 5,
  className,
  onScanSelect,
  realtimeStatus,
  isValidating,
  refreshError,
  onRefresh,
}: AttendanceScanFeedPanelProps) {
  const resolvedBranchId = branchId ?? feed.branchId;
  const resolvedBranchName = branchName ?? feed.branchName;
  const displayError = feed.error ?? (refreshError ? REFRESH_ERROR : null);
  const dateLabel = formatAttendanceFeedDateLabel(feed.selectedDate, feed.timezone);
  const viewAllHref = buildAttendanceViewAllHref({
    workspace,
    selectedDate,
    branchId: resolvedBranchId,
  });
  const hydrated = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false
  );
  const effectiveStatus: AttendanceRealtimeStatus = hydrated ? realtimeStatus : "offline";
  const connection = statusPresentation[effectiveStatus];

  return (
    <CrmSectionCard
      ariaLabel="Recent attendance scans"
      className={className}
      compact
      noPadding
      title="Attendance Activity"
      description={`${resolvedBranchName ?? "All branches"} - ${dateLabel}`}
      icon={<Bell className="size-4" aria-hidden="true" />}
      badge={
        <span
          className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", connection.className)}
          aria-label={`Attendance feed connection: ${connection.label}`}
        >
          {connection.label}
        </span>
      }
      actions={
        <Link
          href={viewAllHref}
          prefetch={false}
          className="shrink-0 text-xs font-bold text-[#1F4E33] hover:underline"
        >
          View all
        </Link>
      }
      footer={
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--cs-text-muted)]">
          <span>
            {feed.lastHourCount.toLocaleString("en-PH")} {feed.lastHourCount === 1 ? "scan" : "scans"}{" "}
            in the last hour
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 font-semibold hover:text-[#1F4E33]"
            aria-label="Refresh Attendance activity"
          >
            <RefreshCw className={cn("size-3", isValidating && "animate-spin")} aria-hidden="true" />
            {isValidating ? "Refreshing" : "Refresh"}
          </button>
        </div>
      }
    >
      {displayError && feed.items.length === 0 ? (
        <div className="grid gap-3 px-4 py-4 text-sm text-[var(--cs-text-muted)]">
          <p>{REFRESH_ERROR}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-[var(--cs-border)] px-3 text-xs font-bold text-[var(--cs-text)]"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : feed.items.length === 0 ? (
        <div className="px-4 py-5 text-sm text-[var(--cs-text-muted)]">
          No attendance scans yet today.
        </div>
      ) : (
        <div className="divide-y divide-[var(--cs-border-soft)] px-3 py-2">
          {feed.items.slice(0, maxItems).map((scan) => (
            <AttendanceScanFeedRow
              key={scan.rootOperationId ?? scan.eventId}
              scan={scan}
              workspace={workspace}
              selectedDate={selectedDate}
              onSelect={onScanSelect}
            />
          ))}
        </div>
      )}
    </CrmSectionCard>
  );
}

export function AttendanceScanFeedCard(props: AttendanceScanFeedCardProps) {
  const resolvedBranchId = props.branchId ?? props.feed.branchId;
  const maxItems = props.maxItems ?? 5;
  const state = useAttendanceScanFeed({
    workspace: props.workspace,
    selectedDate: props.selectedDate,
    branchId: resolvedBranchId,
    initialFeed: props.feed,
    maxItems,
  });

  return (
    <AttendanceScanFeedPanel
      {...props}
      feed={state.feed}
      maxItems={maxItems}
      realtimeStatus={state.realtimeStatus}
      isValidating={state.isValidating}
      refreshError={state.error}
      onRefresh={state.refreshFeed}
    />
  );
}


