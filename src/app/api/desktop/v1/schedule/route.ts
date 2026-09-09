import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getSchedulingRules } from "@/lib/scheduling/rules/get-scheduling-rules";
import { logError } from "@/lib/logger";
import { isValidCalendarDate } from "@/lib/schedule/schedule-date";
/**
 * GET /api/desktop/v1/schedule
 *
 * Returns the daily schedule workspace for the authenticated operator's branch.
 *
 * Query parameters:
 *   date  YYYY-MM-DD  (required)
 *
 * Auth: Bearer <Supabase access_token>
 * Branch: resolved server-side from authenticated staff record.
 *
 * RLS: All reads flow through the user's bearer-auth Supabase client. The
 *      RLS policies on bookings, blocked_times, schedule_overrides,
 *      staff_shift_checkins, and staff enforce branch-scoped access.
 *
 * Roles: All CRM-workspace roles may read. verifyDesktopBearerAuth enforces
 *        canAccessCrmWorkspace before this handler is reached.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await verifyDesktopBearerAuth(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: authResult.code, message: authResult.message },
      { status: authResult.status, headers: { "Cache-Control": "no-store" } }
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
      { status: 403, headers: { "Cache-Control": "no-store" } }
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
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!isValidCalendarDate(date)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Query parameter 'date' is required and must be YYYY-MM-DD.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [staffRows, stats, schedulingRules] = await Promise.all([
      getDailySchedule({ branchId, date, supabase: client }),
      getManagerDashboardStats(branchId, date, client),
      getSchedulingRules(branchId, client),
    ]);

    return NextResponse.json(
      { ok: true, branchId, date, staffRows, stats, schedulingRules },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logError("api.desktop.v1.schedule.get.failed", { error: err, branchId, date });
    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Daily schedule is temporarily unavailable. Please try again.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
