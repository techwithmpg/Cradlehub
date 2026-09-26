"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock,
  Equal,
  FileText,
  Plus,
  TrendingUp,
} from "lucide-react";
import type { AttendanceRealtimeStatus } from "@/components/features/attendance/use-attendance-scan-realtime";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import { formatAttendanceScanTime } from "@/lib/attendance/scan-feed";
import { cn } from "@/lib/utils";

export function CradleFlowSideRail({
  branchName,
  attendanceFeed,
  readinessStatus,
  readinessIssues,
  payment,
  onAttendanceSelect,
  onReviewReadiness,
  onOpenCashFlowModal,
}: {
  branchName: string;
  attendanceDate: string;
  attendanceFeed: AttendanceScanFeedData;
  attendanceRealtimeStatus: AttendanceRealtimeStatus;
  attendanceRefreshing: boolean;
  attendanceRefreshError: string | null;
  onAttendanceRefresh: () => void;
  readinessStatus: ReadinessStatus;
  readinessIssues: ReadinessIssue[];
  payment?: CrmTodayPayment | null;
  onAttendanceSelect: (scan: RecentAttendanceScan) => void;
  onReviewReadiness: () => void;
  onOpenCashFlowModal: () => void;
}) {
  const critical = readinessIssues.filter((issue) => issue.severity === "critical").length;
  const warnings = readinessIssues.filter((issue) => issue.severity === "warning").length;
  const readinessLabel =
    readinessStatus === "ok"
      ? "Operational checks clear"
      : readinessStatus === "warning"
        ? "Review warnings"
        : "Needs attention";

  const attendanceItems = attendanceFeed.items.slice(0, 25);

  return (
    <aside className="space-y-3.5 min-w-0">
      {/* 1. Attendance Activity */}
      <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-3.5 text-stone-500" />
            <h2 className="text-sm font-bold text-[var(--cs-text)]">Attendance Activity</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Live
            </span>
          </div>
          <Link
            href="/crm/attendance"
            className="text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
          >
            View all
          </Link>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">
          {branchName} · Today
        </p>

        {attendanceItems.length > 0 ? (
          <div className="mt-3 max-h-[175px] overflow-y-auto divide-y divide-stone-100 pr-1">
            {attendanceItems.map((scan) => {
              const isLate = scan.attendanceStatus === "late";
              const isOut = scan.eventType === "clock_out";
              const statusText = isLate ? "Late" : isOut ? "Checked out" : "Checked in";
              const time = formatAttendanceScanTime(scan.occurredAt, scan.timezone);
              const name = scan.staffName || scan.staffNickname;

              return (
                <button
                  key={scan.rootOperationId ?? scan.eventId}
                  type="button"
                  onClick={() => onAttendanceSelect(scan)}
                  className="flex w-full items-center justify-between py-2 text-left text-xs transition hover:bg-stone-50/70 rounded-md px-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isLate ? "bg-amber-500" : isOut ? "bg-stone-400" : "bg-emerald-500"
                      )}
                    />
                    <span className="font-mono text-[11px] text-stone-500 shrink-0">{time}</span>
                    <span className="truncate font-semibold text-[var(--cs-text)]">{name}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0",
                      isLate
                        ? "bg-amber-50 text-amber-700"
                        : isOut
                          ? "bg-stone-100 text-stone-600"
                          : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {statusText}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 py-3 text-center text-xs text-[var(--cs-text-muted)]">
            No attendance activity recorded yet today.
          </p>
        )}
      </section>

      {/* 2. Fast Actions (2x2 Grid) */}
      <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
        <h2 className="text-sm font-bold text-[var(--cs-text)]">Fast Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {/* Action 1: Cash Flow Entry (Central Modal UI) */}
          <button
            type="button"
            onClick={onOpenCashFlowModal}
            className="flex flex-col rounded-xl border border-[var(--cs-border-soft)] bg-white p-2.5 text-left transition hover:border-stone-300 hover:shadow-xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition">
              <Plus className="size-4" />
            </span>
            <span className="mt-2 text-xs font-bold text-[var(--cs-text)]">Cash Flow Entry</span>
            <span className="text-[10px] text-[var(--cs-text-muted)]">Record payment / expense</span>
          </button>

          {/* Action 2: Check Schedule */}
          <Link
            href="/crm/schedule"
            className="flex flex-col rounded-xl border border-[var(--cs-border-soft)] bg-white p-2.5 text-left transition hover:border-stone-300 hover:shadow-xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#FDF3EB] text-[#C27848] group-hover:bg-amber-100 transition">
              <CalendarDays className="size-4" />
            </span>
            <span className="mt-2 text-xs font-bold text-[var(--cs-text)]">Check Schedule</span>
            <span className="text-[10px] text-[var(--cs-text-muted)]">View staff and rooms</span>
          </Link>

          {/* Action 3: Review Financial Summary */}
          <Link
            href="/crm/cash-flow"
            className="flex flex-col rounded-xl border border-[var(--cs-border-soft)] bg-white p-2.5 text-left transition hover:border-stone-300 hover:shadow-xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 group-hover:bg-teal-100 transition">
              <TrendingUp className="size-4" />
            </span>
            <span className="mt-2 text-xs font-bold text-[var(--cs-text)]">Review Financial Summary</span>
            <span className="text-[10px] text-[var(--cs-text-muted)]">Today’s cash flow</span>
          </Link>

          {/* Action 4: Add Follow-up */}
          <Link
            href="/crm/customers?tab=followup"
            className="flex flex-col rounded-xl border border-[var(--cs-border-soft)] bg-white p-2.5 text-left transition hover:border-stone-300 hover:shadow-xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#FDF3EB] text-[#C27848] group-hover:bg-amber-100 transition">
              <FileText className="size-4" />
            </span>
            <span className="mt-2 text-xs font-bold text-[var(--cs-text)]">Add Follow-up</span>
            <span className="text-[10px] text-[var(--cs-text-muted)]">Create a customer task</span>
          </Link>
        </div>
      </section>

      {/* 3. Money Today (2x2 Metric Grid with truthful interim semantics) */}
      <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--cs-text)]">Money Today</h2>
          <Link
            href="/crm/cash-flow"
            className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
          >
            View details <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {/* Inflow (Payments) */}
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/30 p-2.5">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <ArrowUpRight className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Inflow
              </span>
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums text-[var(--cs-text)]">
              {formatCradleFlowMoney(payment?.total_collected ?? 0)}
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">Recorded payments</p>
          </div>

          {/* Outflow */}
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/30 p-2.5">
            <div className="flex items-center gap-1.5 text-rose-700">
              <ArrowDownRight className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Outflow
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-stone-400">
              —
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">Ledger pending</p>
          </div>

          {/* Net */}
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/30 p-2.5">
            <div className="flex items-center gap-1.5 text-sky-700">
              <Equal className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Net
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-stone-400">
              —
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">Ledger pending</p>
          </div>

          {/* Outstanding */}
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/30 p-2.5">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Outstanding
              </span>
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums text-[var(--cs-text)]">
              {formatCradleFlowMoney(payment?.total_unpaid ?? 0)}
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">
              {payment?.unpaid_count ?? 0} bookings
            </p>
          </div>
        </div>
      </section>

      {/* 4. Readiness */}
      <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--cs-text)]">Readiness</h2>
          <button
            type="button"
            onClick={onReviewReadiness}
            className="rounded-lg border border-[var(--cs-border-soft)] px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
          >
            Review
          </button>
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[var(--cs-text-secondary)]">Status</span>
            <span
              className={cn(
                "font-semibold",
                readinessStatus === "ok" ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {readinessLabel}
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-t border-stone-100 pt-1.5">
            <span className="text-[var(--cs-text-secondary)]">Critical</span>
            <span className="font-bold tabular-nums text-[var(--cs-text)]">{critical}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-t border-stone-100 pt-1.5">
            <span className="text-[var(--cs-text-secondary)]">Warnings</span>
            <span className="font-bold tabular-nums text-[var(--cs-text)]">{warnings}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}
