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
import { useWorkspaceEntityDelta } from "@/lib/workspace/entity-delta-bus";

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
  assistanceEnabled?: boolean;
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
  assistanceEnabled = false,
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
        readinessAvailable: false,
      },
    [initialData, queueData, snapshot, actionNotifications, readinessIssues, readinessStatus]
  );

  const { data, error, revalidate, generation, patchData } =
    useGenerationAwareWorkspaceSWR<CrmTodayOperationalData>(
      "crm-work-queue",
      "/crm/today",
      refreshAction,
      fallbackOperationalData
    );

  const activeData = data ?? fallbackOperationalData;
  const branchId =
    attendanceScanFeed.branchId ?? activeData.queueData[0]?.branch_id ?? null;

  useWorkspaceEntityDelta(branchId, (delta) => {
    if (delta.kind === "booking.status_patched" || delta.kind === "booking.upserted") {
      const b = delta.booking;
      patchData((current) => {
        const exists = current.queueData.some((row) => row.id === b.id);
        if (!exists) return current;
        return {
          ...current,
          queueData: current.queueData.map((row) =>
            row.id === b.id
              ? {
                  ...row,
                  ...(b.status !== undefined ? { status: b.status } : {}),
                  ...(b.bookingProgressStatus !== undefined
                    ? { booking_progress_status: b.bookingProgressStatus ?? undefined }
                    : {}),
                  ...(b.paymentStatus !== undefined && b.paymentStatus !== null
                    ? { payment_status: b.paymentStatus }
                    : {}),
                  ...(b.amountPaid !== undefined && b.amountPaid !== null
                    ? { amount_paid: b.amountPaid }
                    : {}),
                  ...(b.staffId !== undefined ? { staff_id: b.staffId } : {}),
                  ...(b.staffName !== undefined ? { staff_name: b.staffName } : {}),
                  ...(b.resourceId !== undefined ? { resource_id: b.resourceId } : {}),
                  ...(b.resourceName !== undefined ? { resource_name: b.resourceName } : {}),
                }
              : row
          ),
        };
      });
    } else if (delta.kind === "financial.payment_recorded") {
      const p = delta.payment;
      patchData((current) => ({
        ...current,
        queueData: current.queueData.map((row) =>
          (p.bookingId && row.id === p.bookingId) || (p.orderId && row.order_id === p.orderId)
            ? {
                ...row,
                payment_status: "paid",
                order_payment_status: "paid",
                payment_method: p.paymentMethod || row.payment_method,
                amount_paid: (row.amount_paid ?? 0) + p.amount,
              }
            : row
        ),
      }));
    }
  });

  return (
    <div className="cs-module-reveal">
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
        assistanceEnabled={assistanceEnabled}
        onRefresh={revalidate}
        isRefreshing={generation.isRefreshing}
        refreshError={error}
      />
    </div>
  );
}
