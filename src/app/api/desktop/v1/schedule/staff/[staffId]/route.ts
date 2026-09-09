import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getStaffFullSchedule } from "@/lib/schedule/staff-full-schedule";
import { isValidCalendarDate } from "@/lib/schedule/schedule-date";
import { logError } from "@/lib/logger";

const staffIdSchema = z.guid("Invalid staff ID");

type RouteContext = {
  params: Promise<{
    staffId: string;
  }>;
};

/**
 * GET /api/desktop/v1/schedule/staff/:staffId
 *
 * Query:
 *   startDate=YYYY-MM-DD
 *   endDate=YYYY-MM-DD
 *
 * Auth:
 *   Bearer Supabase access token.
 *
 * Authority:
 *   - operator branch is resolved server-side
 *   - client cannot select another branch
 *   - target staff is constrained to the operator branch
 *   - reads use the bearer-auth user-scoped Supabase client
 *   - RLS remains authoritative
 */
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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

  if (!staff || !staff.branch_id) {
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

  const params = await context.params;
  const parsedStaffId = staffIdSchema.safeParse(params.staffId);

  if (!parsedStaffId.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "A valid staff ID is required.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const startDate = req.nextUrl.searchParams.get("startDate") ?? "";

  const endDate = req.nextUrl.searchParams.get("endDate") ?? "";

  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate) || startDate > endDate) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message:
          "startDate and endDate are required, must be YYYY-MM-DD, and startDate must not be after endDate.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const data = await getStaffFullSchedule({
      supabase: client,
      branchId: staff.branch_id,
      staffId: parsedStaffId.data,
      startDate,
      endDate,
    });

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Staff schedule was not found.",
        },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        branchId: staff.branch_id,
        staffId: parsedStaffId.data,
        startDate,
        endDate,
        data,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logError("api.desktop.v1.schedule.staff.get.failed", {
      error,
      branchId: staff.branch_id,
      staffId: parsedStaffId.data,
      startDate,
      endDate,
    });

    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Staff schedule is temporarily unavailable. Please try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
