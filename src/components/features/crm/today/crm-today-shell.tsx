"use client";

import { useMemo } from "react";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { CradleFlowDashboard } from "./cradle-flow-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { FrontDeskDutyContext } from "@/lib/queries/front-desk-duty";
import type { CrmTodayOperationalData } from "@/lib/queries/crm-today-operational";
import { refreshCrmTodayOperationalDataAction } from "@/app/(dashboard)/crm/today/actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";

type CrmTodayMutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;

export type CrmTodayShellProps = {
  duty: FrontDeskDutyContext | null;
  handoverConfirmed: boolean;
  branchName: string;
  dateLabel: string;
  roleLabel: string;
  initialData?: CrmTodayOperationalData;
  queueData: CradleFlowBooking[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  attendanceScanFeed: AttendanceScanFeedData;
  attendanceScanDate: string;
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  paymentAction?: CrmTodayMutationAction;
  statusAction?: CrmTodayMutationAction;
  refreshAction?: () => Promise<CrmTodayOperationalData>;
};

export function CrmTodayShell({
  duty,
  handoverConfirmed,
  branchName,
  dateLabel,
  initialData,
  queueData,
  snapshot,
  actionNotifications,
  attendanceScanFeed,
  attendanceScanDate,
  readinessIssues,
  readinessStatus,
  paymentAction,
  statusAction,
  refreshAction = refreshCrmTodayOperationalDataAction,
}: CrmTodayShellProps) {
  const fallbackOperationalData: CrmTodayOperationalData = useMemo(
    () =>
      initialData ?? {
        queueData,
        snapshot,
        actionNotifications,
        readinessIssues,
        readinessStatus,
      },
    [initialData, queueData, snapshot, actionNotifications, readinessIssues, readinessStatus]
  );

  const { data, error, revalidate, generation } =
    useGenerationAwareWorkspaceSWR<CrmTodayOperationalData>(
      "crm-work-queue",
      "/crm/today",
      refreshAction,
      fallbackOperationalData
    );

  const activeData = data ?? fallbackOperationalData;

  return (
    <CradleFlowDashboard
      duty={duty}
      handoverConfirmed={handoverConfirmed}
      branchName={branchName}
      dateLabel={dateLabel}
      queueData={activeData.queueData}
      snapshot={activeData.snapshot}
      actionNotifications={activeData.actionNotifications}
      attendanceScanFeed={attendanceScanFeed}
      attendanceScanDate={attendanceScanDate}
      readinessIssues={activeData.readinessIssues}
      readinessStatus={activeData.readinessStatus}
      paymentAction={paymentAction}
      statusAction={statusAction}
      onRefresh={revalidate}
      isRefreshing={generation.isRefreshing}
      refreshError={error}
    />
  );
}
