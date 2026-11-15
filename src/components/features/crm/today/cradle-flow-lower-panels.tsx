"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Bell, Clock3 } from "lucide-react";
import { CrmSectionCard } from "@/components/features/crm/shared/crm-cards";
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
    <CrmSectionCard
      title="Recent Activity"
      description="Operational events from today."
      icon={<Bell className="size-4" />}
      compact
    >
      {items.length ? (
        <div className="grid gap-1">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 text-xs transition hover:bg-[#FAF8F5]"
            >
              <span className="flex items-center gap-1 text-[var(--cs-text-muted)]">
                <Clock3 className="size-3" />
                {item.time}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[var(--cs-text)]">{item.title}</strong>
                <span className="block truncate text-[var(--cs-text-muted)]">{item.detail}</span>
              </span>
              <span className="rounded-full bg-[#EEF7F1] px-2.5 py-0.5 text-[10px] font-bold text-[#1F4E33] ring-1 ring-[#CFE5D6]">
                {item.kind}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--cs-text-muted)]">
          Activity will appear as the day gets moving.
        </p>
      )}
    </CrmSectionCard>
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
    <CrmSectionCard
      title="Today’s Money"
      icon={<Banknote className="size-4" aria-hidden="true" />}
      compact
      actions={
        <Link
          href="/crm/cash-flow"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#1F4E33] hover:underline"
        >
          View in Cash Flow <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
      footer={
        <p className="text-[11px] text-[var(--cs-text-muted)]">
          Booking collections for this branch and date.
        </p>
      }
    >
      <dl className="divide-y divide-[var(--cs-border-soft)]">
        {[
          ["Collected", collectedOverride],
          ["Expected from today’s visits", payment?.total_expected ?? 0],
          ["Outstanding", payment?.total_unpaid ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="flex items-center justify-between gap-2 py-2 text-xs"
          >
            <dt className="text-[var(--cs-text-secondary)]">{label}</dt>
            <dd className="font-extrabold tabular-nums text-[var(--cs-text)]">
              {formatCradleFlowMoney(Number(value))}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onShowReadyToPay}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#1F4E33] transition hover:border-[#CFE5D6] hover:bg-[#EEF7F1]"
      >
        <span>
          {readyToPayCount} {readyToPayCount === 1 ? "visit" : "visits"} ready for payment
        </span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onViewTotals}
        className="mt-2.5 text-xs font-semibold text-[var(--cs-text-muted)] hover:text-[#1F4E33] hover:underline"
      >
        View booking collection totals
      </button>
    </CrmSectionCard>
  );
}
