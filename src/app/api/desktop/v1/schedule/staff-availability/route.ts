import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { logError } from "@/lib/logger";

/**
 * GET /api/desktop/v1/schedule/staff-availability
 *
 * Returns the Schedule Setup staff availability overview for the
 * authenticated operator's branch.
 *
 * Auth: Bearer <Supabase access_token>
 * Branch: resolved server-side from authenticated staff record.
 *
 * RLS: Reads flow through the user's bearer-auth Supabase client. Staff and
 *      schedule_overrides RLS enforces branch-scoped access.
 *
 * Roles: All CRM-workspace roles may read.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  void req.url;
  const authResult = await verifyDesktopBearerAuth(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: authResult.code, message: authResult.message },
      { status: authResult.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { operator, client } = authResult;
  const branchId = operator.staff.branch_id;

  if (!branchId) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No branch associated with this staff account.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const items = await getStaffWithAvailability(branchId, client);
    return NextResponse.json(
      { ok: true, branchId, items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logError("api.desktop.v1.schedule.staff-availability.get.failed", { error: err, branchId });
    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Staff availability is temporarily unavailable. Please try again.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
