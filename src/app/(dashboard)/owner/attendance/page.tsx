import { headers } from "next/headers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AttendanceWorkspace } from "@/components/features/attendance/attendance-workspace";
import {
  buildAttendanceRecordFilters,
  oneAttendanceParam,
  type AttendanceSearchParams,
} from "@/lib/attendance/record-filters";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { loadOwnerAttendanceBranch } from "@/lib/attendance/owner-attendance-branch";
import { parseAttendanceTab } from "@/lib/attendance/tabs";
import { getRequestOrigin } from "@/lib/http/request-origin";

export default async function OwnerAttendancePage({
  searchParams,
}: {
  searchParams: Promise<AttendanceSearchParams>;
}) {
  const params = await searchParams;
  const branchResult = await loadOwnerAttendanceBranch(
    oneAttendanceParam(params.branchId)
  );
  const activeTab = parseAttendanceTab(params.tab);
  const headerStore = await headers();

  let data = null;
  let error: string | null = branchResult.branch
    ? null
    : "No active branch is available.";

  try {
    if (branchResult.branch) {
      data = await getAttendanceWorkspaceData({
        branchId: branchResult.branch.id,
        branchName: branchResult.branch.name ?? "Branch",
        origin: getRequestOrigin(headerStore),
        canSwitchBranch: true,
      });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Attendance data could not be loaded.";
  }

  const filterResult = data
    ? buildAttendanceRecordFilters(params, data, branchResult.branch?.id ?? "")
    : null;

  return (
    <section>
      {error || !data ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load attendance</AlertTitle>
          <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
        </Alert>
      ) : (
        <AttendanceWorkspace
          data={data}
          activeTab={activeTab}
          initialNowMs={data.serverNowMs}
          initialRecordFilters={filterResult?.filters}
          routeBasePath="/owner/attendance"
          routeBranchId={branchResult.branch?.id}
          flash={{
            status: oneAttendanceParam(params.status),
            message:
              oneAttendanceParam(params.message) ??
              branchResult.warning ??
              filterResult?.warning,
            activationUrl: oneAttendanceParam(params.activationUrl),
            expiresAt: oneAttendanceParam(params.expiresAt),
          }}
        />
      )}
    </section>
  );
}
