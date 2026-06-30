"use client";

import type { BookingListItemData } from "./crm-booking-list-item";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { WorkQueueDashboard } from "./work-queue-dashboard";
import type { WorkQueueBooking } from "./work-queue-panel";
import type { AvailableDriver } from "@/components/features/control-console/driver-assign-menu";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";

type CrmTodayMutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type CrmTodayTrackingAction = (input: unknown) => Promise<{ ok: boolean; message?: string; error?: string }>;

export function CrmTodayShell({
  branchName,
  dateLabel,
  roleLabel,
  queueData,
  snapshot,
  actionNotifications,
  readinessIssues,
  readinessStatus,
  viewerRole,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
  getTrackingLinkAction,
  refreshEtaAction,
}: {
  branchName: string;
  dateLabel: string;
  roleLabel: string;
  queueData: BookingListItemData[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  viewerRole: string;
  paymentAction?: CrmTodayMutationAction;
  statusAction?: CrmTodayMutationAction;
  assignDriverAction?: CrmTodayMutationAction;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: CrmTodayTrackingAction;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
}) {
  return (
    <WorkQueueDashboard
      branchName={branchName}
      dateLabel={dateLabel}
      roleLabel={roleLabel}
      viewerRole={viewerRole}
      queueData={queueData as WorkQueueBooking[]}
      snapshot={snapshot}
      actionNotifications={actionNotifications}
      readinessIssues={readinessIssues}
      readinessStatus={readinessStatus}
      paymentAction={paymentAction}
      statusAction={statusAction}
      assignDriverAction={assignDriverAction}
      availableDrivers={availableDrivers}
      getTrackingLinkAction={getTrackingLinkAction}
      refreshEtaAction={refreshEtaAction}
    />
  );
}
