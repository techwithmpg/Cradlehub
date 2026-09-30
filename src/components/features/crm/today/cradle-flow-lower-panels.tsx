"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Bell, Clock3 } from "lucide-react";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import { formatAttendanceScanTime, getAttendanceScanEventLabel } from "@/lib/attendance/scan-feed";

export function CradleFlowRecentActivity({
  attendance,
  notifications,
}: {
  attendance: AttendanceScanFeedData;
  notifications: { id: string; title: string; message?: string }[];
}) {
  const items = [
    ...attendance.items.slice(0, 4).map((scan) => ({
      id: scan.rootOperationId ?? scan.eventId,
      time: formatAttendanceScanTime(scan.occurredAt, scan.timezone),
      title: `${scan.staffNickname || scan.staffName} ${getAttendanceScanEventLabel(scan).toLowerCase()}`,
      detail: scan.branchName ?? "Attendance",
      kind: "Attendance",
    })),
    ...notifications.slice(0, 2).map((notification) => ({
      id: notification.id,
      time: "Action",
      title: notification.title,
      detail: notification.message ?? "Needs front-desk review",
      kind: "System",
    })),
  ];
  return (
    <section className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold">Recent Activity</h2>
          <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
            Operational events from today.
          </p>
        </div>
        <Bell className="size-4 text-[var(--cs-sand-dark)]" />
      </div>
      {items.length ? (
        <div className="mt-3 grid gap-1">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-xs hover:bg-[var(--cs-surface-warm)]"
            >
              <span className="flex items-center gap-1 text-[var(--cs-text-muted)]">
                <Clock3 className="size-3" />
                {item.time}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[var(--cs-text)]">{item.title}</strong>
                <span className="block truncate text-[var(--cs-text-muted)]">{item.detail}</span>
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                {item.kind}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--cs-text-muted)]">
          Activity will appear as the day gets moving.
        </p>
      )}
    </section>
  );
}

export function CradleFlowMoneySummary({
  payment,
  collectedOverride,
  onViewTotals,
  readyToPayCount,
  onShowReadyToPay,
}: {
  payment: CrmTodayPayment | null;
  collectedOverride: number;
  onViewTotals: () => void;
  readyToPayCount: number;
  onShowReadyToPay: () => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--cs-border-soft)] pb-2.5">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--cs-text)]">
          <Banknote className="size-4 text-emerald-700" aria-hidden="true" /> Today’s Money
        </h2>
        <Link href="/crm/cash-flow" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline">
          View in Cash Flow <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
      <dl className="divide-y divide-[var(--cs-border-soft)]">
        {[
          ["Collected", collectedOverride],
          ["Expected from today’s visits", payment?.total_expected ?? 0],
          ["Outstanding", payment?.total_unpaid ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between gap-2 py-2 text-[11px]">
            <dt className="text-[var(--cs-text-secondary)]">{label}</dt>
            <dd className="font-extrabold tabular-nums text-[var(--cs-text)]">{formatCradleFlowMoney(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onShowReadyToPay} className="mt-1 flex w-full items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] font-bold text-orange-800 hover:bg-orange-100">
        <span>{readyToPayCount} {readyToPayCount === 1 ? "visit" : "visits"} ready for payment</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" onClick={onViewTotals} className="mt-2 text-[11px] font-semibold text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] hover:underline">
        View booking collection totals
      </button>
      <p className="mt-1 text-[10px] text-[var(--cs-text-muted)]">Booking collections for this branch and date.</p>
    </section>
  );
}
