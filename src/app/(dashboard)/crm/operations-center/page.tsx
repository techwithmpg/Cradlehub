import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import {
  buildOperationsIssues,
  recentUnsuccessfulScans,
  type OperationalStaffMember,
} from "@/lib/operations-center/issue-model";
import { OperationsCenterView } from "@/components/features/operations-center/operations-center-view";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  // A failed feed is unknown, never an empty/successful diagnostic result.
  // Existing query and remediation services remain the only business authority.
  const [attendanceResult, configurationResult, staffResult] = await Promise.allSettled([
    getAttendanceWorkspaceData({
      branchId: context.branchId,
      branchName: context.branchName,
      historyDays: 0,
      openExceptionsOnly: true,
    }),
    getCrmSetupHealth(context.branchId),
    supabase
      .from("staff")
      .select("id, full_name, nickname, phone, system_role, staff_type, tier, is_active, branch_id, auth_user_id, identity_verified_at, archived_at, merged_into_staff_id, created_at")
      .eq("branch_id", context.branchId)
      .order("full_name"),
  ]);

  const attendance = attendanceResult.status === "fulfilled" ? attendanceResult.value : null;
  const configuration = configurationResult.status === "fulfilled" ? configurationResult.value : null;

  // Review Item 2: Check both Supabase query error and outer Promise result.
  // Never represent an unsuccessful query as an empty staff list.
  let staffRows: OperationalStaffMember[] | null = null;
  if (staffResult.status === "fulfilled") {
    const { data, error } = staffResult.value;
    if (!error && Array.isArray(data)) {
      staffRows = data;
    } else {
      console.error("[operations-center] staff query failed:", error?.message);
      staffRows = null;
    }
  } else {
    console.error("[operations-center] staff query promise rejected:", staffResult.reason);
    staffRows = null;
  }

  const staffAvailable = staffRows !== null;

  return (
    <OperationsCenterView
      branchId={context.branchId}
      branchName={context.branchName}
      checkedAt={new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
      search={search}
      issues={buildOperationsIssues(attendance, configuration, staffRows)}
      scans={recentUnsuccessfulScans(attendance)}
      attendanceAvailable={attendance !== null}
      configurationAvailable={configuration !== null}
      staffAvailable={staffAvailable}
      attendanceData={attendance}
      branchStaff={staffRows ?? []}
    />
  );
}
