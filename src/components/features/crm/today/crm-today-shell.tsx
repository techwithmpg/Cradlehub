"use client";

import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { CradleFlowDashboard } from "./cradle-flow-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

type CrmTodayMutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;

export function CrmTodayShell({
  branchName,
  dateLabel,
  queueData,
  snapshot,
  actionNotifications,
  attendanceScanFeed,
  attendanceScanDate,
  readinessIssues,
  readinessStatus,
  paymentAction,
  statusAction,
}: {
  branchName: string;
  dateLabel: string;
  roleLabel: string;
  queueData: CradleFlowBooking[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  attendanceScanFeed: AttendanceScanFeedData;
  attendanceScanDate: string;
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  paymentAction?: CrmTodayMutationAction;
  statusAction?: CrmTodayMutationAction;
}) {
  return (
    <CradleFlowDashboard
      key={queueData
        .map(
          (booking) =>
            `${booking.id}:${booking.status}:${booking.payment_status}:${booking.amount_paid ?? 0}`
        )
        .join("|")}
      branchName={branchName}
      dateLabel={dateLabel}
      queueData={queueData}
      snapshot={snapshot}
      actionNotifications={actionNotifications}
      attendanceScanFeed={attendanceScanFeed}
      attendanceScanDate={attendanceScanDate}
      readinessIssues={readinessIssues}
      readinessStatus={readinessStatus}
      paymentAction={paymentAction}
      statusAction={statusAction}
    />
  );
}
