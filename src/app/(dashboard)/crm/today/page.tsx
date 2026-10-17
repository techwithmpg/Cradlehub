import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getFrontDeskDutyContext } from "@/lib/queries/front-desk-duty";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { CrmTodayShell } from "@/components/features/crm/today/crm-today-shell";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { SYSTEM_ROLE_LABELS, canonicalizeSystemRole } from "@/constants/staff";
import { updateWorkQueueBookingStatusAction } from "./actions";
import {
  createAttendanceScanFeedFallback,
  getRecentAttendanceScanFeed,
} from "@/lib/attendance/recent-scans";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { getCrmTodayOperationalData } from "@/lib/queries/crm-today-operational";

export default async function CrmTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await getFrontDeskContext();
  const { branchId, branchName, role } = context;
  const today = getBranchBusinessDate();
  const params = await searchParams;

  const [duty, operationalData, attendanceScanFeed] = await Promise.all([
    getFrontDeskDutyContext(
      context,
      today,
      typeof params.handover === "string" ? params.handover : undefined
    ),
    getCrmTodayOperationalData({ branchId, date: today }),
    getRecentAttendanceScanFeed({
      workspace: "crm",
      branchId,
      branchName,
      selectedDate: today,
      maxItems: 5,
    }).catch(() =>
      createAttendanceScanFeedFallback({
        workspace: "crm",
        branchId,
        branchName,
        selectedDate: today,
        error: "Attendance activity could not be refreshed.",
      })
    ),
  ]);

  const canonicalRole = canonicalizeSystemRole(role);
  const roleLabel = SYSTEM_ROLE_LABELS[canonicalRole as keyof typeof SYSTEM_ROLE_LABELS] ?? "CRM";

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <RetainedWorkspaceModule moduleId="crm-work-queue">
      <CrmTodayShell
        duty={duty}
        handoverConfirmed={duty?.confirmedHandover ?? false}
        branchName={branchName}
        dateLabel={dateLabel}
        roleLabel={roleLabel}
        initialData={operationalData}
        queueData={operationalData.queueData}
        snapshot={operationalData.snapshot}
        actionNotifications={operationalData.actionNotifications}
        attendanceScanFeed={attendanceScanFeed}
        attendanceScanDate={today}
        readinessIssues={operationalData.readinessIssues}
        readinessStatus={operationalData.readinessStatus}
        paymentAction={updateBookingPaymentAction}
        statusAction={updateWorkQueueBookingStatusAction}
      />
    </RetainedWorkspaceModule>
  );
}
