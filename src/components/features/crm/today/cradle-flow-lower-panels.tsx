"use client";

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
      id: scan.eventId,
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
            Live operational events from today.
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
}: {
  payment: CrmTodayPayment | null;
  collectedOverride: number;
  onViewTotals: () => void;
}) {
  const collected = collectedOverride;
  return (
    <section className="rounded-xl border border-[#d5c096] bg-[linear-gradient(135deg,#fffaf0,#f8f1df)] p-4 shadow-[var(--cs-shadow-xs)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#164b36] text-white">
            <Banknote className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--cs-text)]">Today’s Money</h2>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Booking collections, not a drawer close.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[
            ["Collected", collected],
            ["Expected", payment?.total_expected ?? 0],
            ["Outstanding", payment?.total_unpaid ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="text-right">
              <div className="text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-extrabold">
                {formatCradleFlowMoney(Number(value))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onViewTotals}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#b78a42] bg-white/70 px-4 text-xs font-bold text-[#6f4a1c]"
        >
          View Day Totals <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
