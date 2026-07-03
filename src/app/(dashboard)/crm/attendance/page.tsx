import { headers } from "next/headers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AttendanceWorkspace } from "@/components/features/attendance/attendance-workspace";
import { parseAttendanceTab } from "@/lib/attendance/tabs";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function CrmAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const activeTab = parseAttendanceTab(params.tab);
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
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Attendance data could not be loaded.";
  }

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
          flash={{
            status: one(params.status),
            message: one(params.message),
            activationUrl: one(params.activationUrl),
            expiresAt: one(params.expiresAt),
          }}
        />
      )}
    </section>
  );
}
