import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getAttendanceHistoryData } from "@/lib/attendance/queries";
import { logError } from "@/lib/logger";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * GET /api/desktop/v1/attendance/history
 *
 * Query:
 *   fromDate=YYYY-MM-DD
 *   toDate=YYYY-MM-DD
 *
 * Maximum range: 366 days.
 *
 * Branch authority is always resolved from bearer-authenticated staff.
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

  const staff = authResult.operator.staff;

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

  const fromDate = req.nextUrl.searchParams.get("fromDate") ?? "";
  const toDate = req.nextUrl.searchParams.get("toDate") ?? "";

  if (!isCalendarDate(fromDate) || !isCalendarDate(toDate)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Query parameters 'fromDate' and 'toDate' are required and must be YYYY-MM-DD.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

  if (days < 0 || days > 366) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Choose an Attendance history range of up to one year.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const data = await getAttendanceHistoryData({
      branchId,
      fromDate,
      toDate,
    });

    return NextResponse.json(
      {
        ok: true,
        branchId,
        fromDate,
        toDate,
        data,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logError("api.desktop.v1.attendance.history.get.failed", {
      error,
      branchId,
      staffId: staff.id,
      fromDate,
      toDate,
    });

    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Attendance history is temporarily unavailable. Please try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
