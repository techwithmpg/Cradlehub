import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { executeInhouseBookingCreation } from "@/lib/bookings/inhouse-booking-engine";
import { logError } from "@/lib/logger";

function mapDomainCodeToHttpStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "STAFF_NOT_FOUND":
    case "CRM_PERMISSION_DENIED":
    case "CRM_BRANCH_FORBIDDEN":
      return 403;
    case "SLOT_UNAVAILABLE":
    case "EXACT_TIME_UNAVAILABLE":
    case "NO_SCHEDULE_AT_START":
    case "RESOURCE_UNAVAILABLE":
    case "DISPATCH_CONFLICT":
    case "DUPLICATE_ERROR":
      return 409;
    case "VALIDATION_ERROR":
    case "INVALID_BOOKING_TIME":
    case "BRANCH_MISSING":
    case "HS_ADDRESS_MISSING":
    case "HS_LOCATION_MISSING":
    case "MANUAL_ARRANGEMENT_REQUIRED":
    case "RESOURCE_INVALID":
    case "CUSTOMER_ERROR":
    case "SERVICE_NOT_FOUND":
    case "SERVICE_INELIGIBLE":
    case "SERVICE_UNAVAILABLE":
    case "SERVICE_NOT_CONFIGURED_FOR_BRANCH":
    case "TIME_TOO_LATE":
      return 400;
    default:
      return 500;
  }
}

export async function POST(req: NextRequest) {
  // 1. Verify Bearer token & authenticated staff context
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

  // 2. Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  // 3. Delegate to the shared server-only booking domain engine
  try {
    const result = await executeInhouseBookingCreation(rawBody, authResult.operator);
    if (!result.ok) {
      const status = mapDomainCodeToHttpStatus(result.code);
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
        },
        {
          status,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        bookingId: result.bookingId,
        ...(result.warning ? { warning: result.warning } : {}),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    logError("api.desktop.v1.bookings.failed", { error: err });
    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Could not create booking. Please try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
