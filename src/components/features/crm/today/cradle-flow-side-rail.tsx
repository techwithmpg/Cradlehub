"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardPlus, LockKeyhole, WalletCards } from "lucide-react";
import { AttendanceScanFeedCard } from "@/components/features/attendance/attendance-scan-feed-card";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";

function RailPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <header className="flex items-center justify-between border-b border-[var(--cs-border-soft)] px-4 py-3">
        <h2 className="text-sm font-extrabold text-[var(--cs-text)]">{title}</h2>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function RailLink({
  href,
  title,
  helper,
  icon,
}: {
  href: string;
  title: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--cs-border-soft)] px-3 py-2.5 transition hover:bg-[var(--cs-surface-warm)]"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block text-xs text-[var(--cs-text)]">{title}</strong>
        <span className="block truncate text-[11px] text-[var(--cs-text-muted)]">{helper}</span>
      </span>
    </Link>
  );
}

export function CradleFlowSideRail({
  branchName,
  attendanceDate,
  attendanceFeed,
  readinessStatus,
  readinessIssues,
  onAttendanceSelect,
  onReviewReadiness,
}: {
  branchName: string;
  attendanceDate: string;
  attendanceFeed: AttendanceScanFeedData;
  readinessStatus: ReadinessStatus;
  readinessIssues: ReadinessIssue[];
  onAttendanceSelect: (scan: RecentAttendanceScan) => void;
  onReviewReadiness: () => void;
}) {
  const critical = readinessIssues.filter((issue) => issue.severity === "critical").length;
  const warnings = readinessIssues.filter((issue) => issue.severity === "warning").length;
  const readinessLabel =
    readinessStatus === "ok"
      ? "Ready"
      : readinessStatus === "warning"
        ? "Review warnings"
        : "Needs attention";
  return (
    <aside className="grid min-w-0 gap-3 xl:sticky xl:top-4 xl:self-start">
      <AttendanceScanFeedCard
        workspace="crm"
        selectedDate={attendanceDate}
        branchId={attendanceFeed.branchId}
        branchName={branchName}
        feed={attendanceFeed}
        maxItems={4}
        onScanSelect={onAttendanceSelect}
        className="rounded-xl"
      />
      <RailPanel title="Fast Actions">
        <div className="grid gap-2">
          <RailLink
            href="/crm/customers?tab=followup"
            title="Add follow-up"
            helper="Create a customer task"
            icon={<ClipboardPlus className="size-4" />}
          />
          <RailLink
            href="/crm/schedule"
            title="Check schedule"
            helper="Review staff and rooms"
            icon={<CalendarDays className="size-4" />}
          />
          <RailLink
            href="/crm/reconciliation"
            title="Open Close Day"
            helper="Reconcile today’s collections"
            icon={<WalletCards className="size-4" />}
          />
          <div
            className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--cs-border)] px-3 py-2.5 opacity-60"
            title="No expense ledger is configured for this workspace."
          >
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--cs-surface-warm)]">
              <LockKeyhole className="size-4" />
            </span>
            <span>
              <strong className="block text-xs">Record expense</strong>
              <span className="block text-[11px] text-[var(--cs-text-muted)]">Not configured</span>
            </span>
          </div>
        </div>
      </RailPanel>
      <RailPanel
        title="Readiness"
        action={
          <button
            type="button"
            onClick={onReviewReadiness}
            className="h-8 rounded-lg border border-[var(--cs-border)] px-3 text-xs font-bold"
          >
            Review
          </button>
        }
      >
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between rounded-lg bg-[var(--cs-surface-warm)] px-3 py-2">
            <span>Status</span>
            <strong className={readinessStatus === "ok" ? "text-emerald-700" : "text-amber-700"}>
              {readinessLabel}
            </strong>
          </div>
          <div className="flex justify-between rounded-lg bg-[var(--cs-surface-warm)] px-3 py-2">
            <span>Critical</span>
            <strong>{critical}</strong>
          </div>
          <div className="flex justify-between rounded-lg bg-[var(--cs-surface-warm)] px-3 py-2">
            <span>Warnings</span>
            <strong>{warnings}</strong>
          </div>
          {readinessStatus === "ok" ? (
            <p className="flex items-center gap-2 px-1 pt-1 text-emerald-700">
              <CheckCircle2 className="size-4" /> Operational checks are clear.
            </p>
          ) : null}
        </div>
      </RailPanel>
    </aside>
  );
}
