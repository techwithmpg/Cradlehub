"use client";

import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, ClipboardPlus, WalletCards } from "lucide-react";
import { AttendanceScanFeedPanel } from "@/components/features/attendance/attendance-scan-feed-card";
import type { AttendanceRealtimeStatus } from "@/components/features/attendance/use-attendance-scan-realtime";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import { CrmActionCard, CrmSectionCard } from "@/components/features/crm/shared/crm-cards";
import { getCradleFlowServiceRecipientName, type CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import type { ReadinessIssue } from "@/types/readiness";
import { groupCradleFlowBookings, type CradleFlowGroup } from "./cradle-flow-display";
import { CradleFlowMoneySummary } from "./cradle-flow-lower-panels";

function RailPanel({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <CrmSectionCard title={title} icon={icon} actions={action} compact>
      {children}
    </CrmSectionCard>
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
    <CrmActionCard
      href={href}
      title={title}
      description={helper}
      icon={icon}
      surface="plain"
      decorative={false}
      compact
      trailing={<ArrowRight className="size-3.5 text-[var(--cs-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1F4E33]" />}
    />
  );
}

export function CradleFlowSideRail({
  assistanceEnabled = false,
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
  onOpenGroup,
  onShowNeedsAction,
  onShowReadyToPay,
  onViewTotals,
}: {
  assistanceEnabled?: boolean;
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
  onOpenGroup?: (group: CradleFlowGroup) => void;
  onShowNeedsAction: () => void;
  onShowReadyToPay: () => void;
  onViewTotals: () => void;
}) {
  const groups = groupCradleFlowBookings(bookings);
  const bookingAttention = groups.flatMap((group) =>
    group.attentionSummary.map((title) => ({
      key: `${group.displayId}-${title}`,
      title,
      detail: group.orderId && group.serviceCount > 1
        ? group.organizerName
        : getCradleFlowServiceRecipientName(group.lines[0]!),
      onClick: () =>
        group.orderId && group.serviceCount > 1
          ? onOpenGroup?.(group)
          : onOpenBooking(group.lines[0]!),
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
    <aside
      className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] content-start gap-3"
      aria-label="Front desk supporting information"
    >
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
      />
      <CradleFlowMoneySummary
        payment={payment}
        collectedOverride={collected}
        readyToPayCount={readyToPayCount}
        onShowReadyToPay={onShowReadyToPay}
        onViewTotals={onViewTotals}
      />
      <RailPanel
        title="Needs Attention"
        icon={<AlertTriangle className="size-4 text-[#A16207]" />}
        action={
          attention.length > 0 ? (
            <button
              type="button"
              onClick={bookingAttention.length ? onShowNeedsAction : onReviewReadiness}
              className="text-[11px] font-bold text-[#1F4E33] hover:underline"
            >
              {bookingAttention.length
                ? `View visits (${groups.filter((group) => group.attentionSummary.length > 0).length})`
                : `Review checks (${readinessAttention.length})`}
            </button>
          ) : null
        }
      >
        {attention.length ? (
          <div className="divide-y divide-[var(--cs-border-soft)]">
            {attention.slice(0, 3).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left transition hover:bg-[#FAF8F5]"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#FDF8EC] text-[#A16207] ring-1 ring-[#EFE1BE]">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-xs text-[var(--cs-text)]">{item.title}</strong>
                  <span className="block truncate text-[11px] text-[var(--cs-text-muted)]">
                    {item.detail}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--cs-text-muted)]">No visits need attention right now.</p>
        )}
      </RailPanel>
      {assistanceEnabled ? (
        <RailPanel title="Staff Coverage" icon={<ArrowLeftRight className="size-4" />}>
          <p className="mb-2.5 text-xs text-[var(--cs-text-muted)]">Short on therapists, nail technicians, or aestheticians? Ask the other branch for support.</p>
          <RailLink href="/crm/schedule?tab=assistance" title="Request Staff Assistance" helper="Schedule → Assistance" icon={<ArrowLeftRight className="size-4" />} />
        </RailPanel>
      ) : null}
      <RailPanel title="Quick Actions" icon={<ClipboardPlus className="size-4" />}>
        <div className="grid gap-2">
          <RailLink
            href="/crm/customers?tab=followup"
            title="Add follow-up"
            helper="Create a customer task"
            icon={<ClipboardPlus className="size-4" />}
          />
          <RailLink
            href="/crm/schedule"
            title="View today’s schedule"
            helper="See bookings and rooms"
            icon={<CalendarDays className="size-4" />}
          />
          <RailLink
            href="/crm/cash-flow"
            title="Open Cash Flow"
            helper="Collections and daily records"
            icon={<WalletCards className="size-4" />}
          />
        </div>
      </RailPanel>
    </aside>
  );
}
