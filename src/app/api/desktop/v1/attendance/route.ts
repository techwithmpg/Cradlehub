import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { logError } from "@/lib/logger";

/**
 * GET /api/desktop/v1/attendance
 *
 * Returns the authoritative current Attendance workspace for the authenticated
 * CRM operator's branch.
 *
 * Auth: Bearer <Supabase access_token>
 *
 * Branch authority:
 * - branch is resolved from the authenticated active staff record
 * - renderer-supplied branch identifiers are ignored
 *
 * Data authority:
 * - delegates to the existing hosted Attendance workspace loader
 * - does not reproduce attendance state, schedule, exception or device logic
 *
 * This route is read-only.
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

  if (!staff) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No active staff profile found for this authenticated user.",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const branchId = staff.branch_id;

  if (!branchId) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No branch associated with this staff account.",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const branchResult = await client
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .maybeSingle();

    if (branchResult.error || !branchResult.data) {
      return NextResponse.json(
        {
          ok: false,
          code: "BRANCH_NOT_FOUND",
          message: "The authenticated Attendance branch is unavailable.",
        },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const data = await getAttendanceWorkspaceData({
      branchId,
      branchName: branchResult.data.name ?? "Branch",
      origin: req.nextUrl.origin,
      canSwitchBranch: false,
      historyDays: 0,
      openExceptionsOnly: true,
    });

    return NextResponse.json(
      {
        ok: true,
        branchId,
        data,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logError("api.desktop.v1.attendance.get.failed", {
      error,
      branchId,
      staffId: staff.id,
    });

    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Attendance is temporarily unavailable. Please try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
