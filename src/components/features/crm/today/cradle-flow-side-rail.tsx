"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardPlus, WalletCards } from "lucide-react";
import { AttendanceScanFeedPanel } from "@/components/features/attendance/attendance-scan-feed-card";
import type { AttendanceRealtimeStatus } from "@/components/features/attendance/use-attendance-scan-realtime";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import type { ReadinessIssue } from "@/types/readiness";
import { getCradleFlowAttention } from "./cradle-flow-display";
import { CradleFlowMoneySummary } from "./cradle-flow-lower-panels";

function RailPanel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]">
      <header className="mb-2.5 flex items-center justify-between gap-2 border-b border-[var(--cs-border-soft)] pb-2.5">
        <h2 className="text-sm font-extrabold text-[var(--cs-text)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function RailLink({ href, title, helper, icon }: { href: string; title: string; helper: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg border border-[var(--cs-border-soft)] px-2.5 py-2 transition hover:bg-[var(--cs-surface-warm)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">{icon}</span>
      <span className="min-w-0">
        <strong className="block text-[11px] text-[var(--cs-text)]">{title}</strong>
        <span className="block truncate text-[10px] text-[var(--cs-text-muted)]">{helper}</span>
      </span>
    </Link>
  );
}

export function CradleFlowSideRail({
  branchName,
  attendanceDate,
  attendanceFeed,
  attendanceRealtimeStatus,
  attendanceRefreshing,
  attendanceRefreshError,
  onAttendanceRefresh,
  bookings,
  payment,
  collected,
  readyToPayCount,
  readinessIssues,
  onAttendanceSelect,
  onReviewReadiness,
  onOpenBooking,
  onShowNeedsAction,
  onShowReadyToPay,
  onViewTotals,
}: {
  branchName: string;
  attendanceDate: string;
  attendanceFeed: AttendanceScanFeedData;
  attendanceRealtimeStatus: AttendanceRealtimeStatus;
  attendanceRefreshing: boolean;
  attendanceRefreshError: string | null;
  onAttendanceRefresh: () => void;
  bookings: CradleFlowBooking[];
  payment: CrmTodayPayment | null;
  collected: number;
  readyToPayCount: number;
  readinessIssues: ReadinessIssue[];
  onAttendanceSelect: (scan: RecentAttendanceScan) => void;
  onReviewReadiness: () => void;
  onOpenBooking: (booking: CradleFlowBooking) => void;
  onShowNeedsAction: () => void;
  onShowReadyToPay: () => void;
  onViewTotals: () => void;
}) {
  const bookingAttention = bookings.flatMap((booking) =>
    getCradleFlowAttention(booking).map((title) => ({
      key: `${booking.id}-${title}`,
      title,
      detail: booking.customer_name ?? `Booking ${booking.id.slice(0, 8)}`,
      onClick: () => onOpenBooking(booking),
    }))
  );
  const readinessAttention = readinessIssues
    .filter((issue) => issue.severity === "critical" || issue.severity === "warning")
    .map((issue) => ({
      key: issue.id,
      title: issue.title,
      detail: issue.problem,
      onClick: onReviewReadiness,
    }));
  const attention = [...bookingAttention, ...readinessAttention];

  return (
    <aside className="grid min-w-0 content-start gap-3" aria-label="Front desk supporting information">
      <CradleFlowMoneySummary
        payment={payment}
        collectedOverride={collected}
        readyToPayCount={readyToPayCount}
        onShowReadyToPay={onShowReadyToPay}
        onViewTotals={onViewTotals}
      />
      <RailPanel
        title="Needs Attention"
        action={attention.length > 0 ? (
          <button type="button" onClick={bookingAttention.length ? onShowNeedsAction : onReviewReadiness} className="text-[11px] font-bold text-blue-700 hover:underline">
            {bookingAttention.length
              ? `View visits (${bookings.filter((booking) => getCradleFlowAttention(booking).length > 0).length})`
              : `Review checks (${readinessAttention.length})`}
          </button>
        ) : null}
      >
        {attention.length ? (
          <div className="divide-y divide-[var(--cs-border-soft)]">
            {attention.slice(0, 3).map((item) => (
              <button key={item.key} type="button" onClick={item.onClick} className="flex w-full items-start gap-2 py-2 text-left hover:bg-[var(--cs-surface-warm)]">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-orange-700" aria-hidden="true" />
                <span className="min-w-0">
                  <strong className="block text-[11px] text-[var(--cs-text)]">{item.title}</strong>
                  <span className="block truncate text-[10px] text-[var(--cs-text-muted)]">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--cs-text-muted)]">No visits need attention right now.</p>
        )}
      </RailPanel>
      <RailPanel title="Quick Actions">
        <div className="grid gap-1.5">
          <RailLink href="/crm/customers?tab=followup" title="Add follow-up" helper="Create a customer task" icon={<ClipboardPlus className="size-4" />} />
          <RailLink href="/crm/schedule" title="View today’s schedule" helper="See bookings and rooms" icon={<CalendarDays className="size-4" />} />
          <RailLink href="/crm/cash-flow" title="Open Cash Flow" helper="Collections and daily records" icon={<WalletCards className="size-4" />} />
        </div>
      </RailPanel>
      <AttendanceScanFeedPanel
        workspace="crm"
        selectedDate={attendanceDate}
        branchId={attendanceFeed.branchId}
        branchName={branchName}
        feed={attendanceFeed}
        maxItems={4}
        realtimeStatus={attendanceRealtimeStatus}
        isValidating={attendanceRefreshing}
        refreshError={attendanceRefreshError}
        onRefresh={onAttendanceRefresh}
        onScanSelect={onAttendanceSelect}
        className="rounded-xl"
      />
    </aside>
  );
}
