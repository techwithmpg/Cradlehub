import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import {
  buildOperationsIssues,
  recentUnsuccessfulScans,
  type OperationalStaffMember,
} from "@/lib/operations-center/issue-model";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/desktop/v1/operations-center
 *
 * Returns authoritative operational diagnostics, active issues, scan failures,
 * and branch health for the authenticated desktop operator's branch.
 *
 * Auth: Bearer <Supabase access_token>
 * Branch isolation: Derived strictly from operator's active staff record.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await verifyDesktopBearerAuth(req);

  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: authResult.code,
        message: authResult.message,
      },
      {
        status: authResult.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const { operator, client } = authResult;
  const staff = operator.staff;

  if (!staff?.branch_id) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "An active staff profile with a branch assignment is required.",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const branchId = staff.branch_id;

  try {
    const branchRes = await client
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .maybeSingle();

    const branchName = branchRes.data?.name ?? "Branch";

    const [attendanceResult, configurationResult, staffResult] = await Promise.allSettled([
      getAttendanceWorkspaceData({
        branchId,
        branchName,
        historyDays: 0,
        openExceptionsOnly: true,
      }),
      getCrmSetupHealth(branchId),
      client
        .from("staff")
        .select(
          "id, full_name, nickname, phone, system_role, staff_type, tier, is_active, branch_id, auth_user_id, identity_verified_at, archived_at, merged_into_staff_id, created_at"
        )
        .eq("branch_id", branchId)
        .order("full_name"),
    ]);

    const attendance = attendanceResult.status === "fulfilled" ? attendanceResult.value : null;
    const configuration = configurationResult.status === "fulfilled" ? configurationResult.value : null;

    let staffRows: OperationalStaffMember[] | null = null;
    if (staffResult.status === "fulfilled") {
      const { data, error } = staffResult.value;
      if (!error && Array.isArray(data)) {
        staffRows = data.map((row) => ({
          id: row.id,
          full_name: row.full_name,
          nickname: row.nickname,
          phone: row.phone,
          system_role: row.system_role,
          staff_type: row.staff_type,
          tier: row.tier,
          is_active: row.is_active,
          branch_id: row.branch_id ?? branchId,
          hasLoginAccount: Boolean(row.auth_user_id),
          isIdentityVerified: Boolean(row.identity_verified_at),
          identity_verified_at: row.identity_verified_at,
          archived_at: row.archived_at,
          merged_into_staff_id: row.merged_into_staff_id,
          created_at: row.created_at,
        }));
      } else {
        logError("api.desktop.operations_center.staff_query_failed", { error });
        staffRows = null;
      }
    } else {
      logError("api.desktop.operations_center.staff_query_rejected", {
        reason: staffResult.reason,
      });
      staffRows = null;
    }

    const attendanceAvailable = attendance !== null;
    const configurationAvailable = configuration !== null;
    const staffAvailable = staffRows !== null;

    const issues = buildOperationsIssues(attendance, configuration, staffRows);
    const scans = recentUnsuccessfulScans(attendance);

    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;
    const attendanceCount = issues.filter((i) => i.area === "attendance").length;
    const staffCount = issues.filter((i) => i.area === "staff_identity").length;
    const configCount = issues.filter((i) => i.area === "configuration").length;
    const unresolvedScanCount = scans.filter((s) => s.isUnresolvedFailure).length;

    const incomplete = !attendanceAvailable || !configurationAvailable || !staffAvailable;
    const readyLabel = incomplete
      ? "Diagnostics Incomplete"
      : criticalCount > 0
        ? `${criticalCount} Critical Problem${criticalCount > 1 ? "s" : ""}`
        : issues.length > 0
          ? `${issues.length} Open Incident${issues.length > 1 ? "s" : ""}`
          : unresolvedScanCount > 0
            ? `${unresolvedScanCount} Blocked Scan${unresolvedScanCount > 1 ? "s" : ""}`
            : "Current Checks Clear";

    const operatorRole = operator.staffRole ?? "crm";
    // Permitted to initiate repairs in context: CRM staff, Managers, Owners
    const canPerformMutations = [
      "owner",
      "manager",
      "assistant_manager",
      "store_manager",
      "crm",
    ].includes(operatorRole);

    return NextResponse.json(
      {
        ok: true,
        data: {
          branchId,
          branchName,
          checkedAt: new Date().toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          }),
          issues,
          scans,
          attendanceAvailable,
          configurationAvailable,
          staffAvailable,
          branchStaff: staffRows ?? [],
          counts: {
            critical: criticalCount,
            warning: warningCount,
            info: infoCount,
            attendance: attendanceCount,
            staff: staffCount,
            configuration: configCount,
            unresolvedScans: unresolvedScanCount,
            totalIssues: issues.length,
          },
          readyLabel,
          operatorRole,
          canPerformMutations,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logError("api.desktop.operations_center.failed", { error });
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: "Failed to load Operations Center diagnostic data. Please refresh and try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
