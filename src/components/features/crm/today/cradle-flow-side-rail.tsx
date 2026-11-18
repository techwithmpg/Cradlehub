"use client";

import { AttendanceScanFeedPanel } from "@/components/features/attendance/attendance-scan-feed-card";
import type { AttendanceRealtimeStatus } from "@/components/features/attendance/use-attendance-scan-realtime";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import type { ReadinessIssue } from "@/types/readiness";
import type { CradleFlowGroup } from "./cradle-flow-display";
import { CradleFlowMoneySummary } from "./cradle-flow-lower-panels";

export type CradleFlowSideRailProps = {
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
};

export function CradleFlowSideRail({
  branchName,
  attendanceDate,
  attendanceFeed,
  attendanceRealtimeStatus,
  attendanceRefreshing,
  attendanceRefreshError,
  onAttendanceRefresh,
  payment,
  collected,
  readyToPayCount,
  onAttendanceSelect,
  onShowReadyToPay,
  onViewTotals,
}: CradleFlowSideRailProps) {
  return (
    <aside
      className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] content-start gap-3"
      aria-label="Attendance activity and today's money"
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
    </aside>
  );
}
