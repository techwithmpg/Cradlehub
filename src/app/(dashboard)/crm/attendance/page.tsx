import { headers } from "next/headers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CrmAttendanceWorkspace } from "@/components/features/attendance/crm-attendance-workspace";
import { parseCrmAttendanceNavigation } from "@/lib/attendance/crm-navigation";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import {
  buildAttendanceRecordFilters,
  oneAttendanceParam,
  type AttendanceSearchParams,
} from "@/lib/attendance/record-filters";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

export default async function CrmAttendancePage({
  searchParams,
}: {
  searchParams: Promise<AttendanceSearchParams>;
}) {
  const params = await searchParams;
  const initialNavigation = parseCrmAttendanceNavigation(params);
  const context = await getFrontDeskContext();
  const headerStore = await headers();

  let data = null;
  let error: string | null = null;
  try {
    const requestOrigin = getRequestOrigin(headerStore);
    data = await getAttendanceWorkspaceData({
      branchId: context.branchId,
      branchName: context.branchName,
      origin: requestOrigin,
      historyDays: 0,
      openExceptionsOnly: true,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Attendance data could not be loaded.";
  }

  const recordFilterResult = data
    ? buildAttendanceRecordFilters(params, data, context.branchId)
    : null;

  return (
    <RetainedWorkspaceModule moduleId="crm-attendance">
      <section>
        {error || !data ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load attendance</AlertTitle>
            <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
          </Alert>
        ) : (
          <CrmAttendanceWorkspace
            data={data}
            initialNavigation={initialNavigation}
            initialStaffId={recordFilterResult?.filters.staffId}
            flash={{
              status: oneAttendanceParam(params.status),
              message: oneAttendanceParam(params.message) ?? recordFilterResult?.warning,
            }}
          />
        )}
      </section>
    </RetainedWorkspaceModule>
  );
}
