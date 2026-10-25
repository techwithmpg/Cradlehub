import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { buildOperationsIssues, recentUnsuccessfulScans } from "@/lib/operations-center/issue-model";
import { OperationsCenterView } from "@/components/features/operations-center/operations-center-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations Center | Front Desk" };

export default async function CrmOperationsCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  // Authoritative CRM access and branch scope. Never trust a branch ID supplied by a caller.
  const context = await getFrontDeskContext();
  const params = await searchParams;
  const search = (typeof params.q === "string" ? params.q : "").trim().slice(0, 96);

  // A failed feed is unknown, never an empty/successful diagnostic result.
  // Existing query and remediation services remain the only business authority.
  const [attendanceResult, configurationResult] = await Promise.allSettled([
    getAttendanceWorkspaceData({
      branchId: context.branchId,
      branchName: context.branchName,
      historyDays: 0,
      openExceptionsOnly: true,
    }),
    getCrmSetupHealth(context.branchId),
  ]);

  const attendance = attendanceResult.status === "fulfilled" ? attendanceResult.value : null;
  const configuration = configurationResult.status === "fulfilled" ? configurationResult.value : null;

  return (
    <OperationsCenterView
      branchName={context.branchName}
      checkedAt={new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
      search={search}
      issues={buildOperationsIssues(attendance, configuration)}
      scans={recentUnsuccessfulScans(attendance)}
      attendanceAvailable={attendance !== null}
      configurationAvailable={configuration !== null}
      attendanceData={attendance}
    />
  );
}
