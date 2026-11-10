import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getMyDriverJobByIdAction,
  updateBookingProgressAction,
} from "@/app/(dashboard)/staff-portal/actions";
import { isValidDriverDestination } from "@/lib/staff-pwa/driver-dispatch-policy";

export const runtime = "nodejs";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Cookie",
  }});
}

/**
 * Thin Android adapter to the EXISTING atomic, role-checked booking action.
 * A tap is a request, NEVER evidence of permission or physical arrival.
 */
export async function POST(request: NextRequest) {
  if (process.env.NATIVE_DRIVER_CONNECTED_ENABLED !== "true") {
    return response({ ok: false, error: "Driver TEST connection is not enabled on this server." }, 503);
  }

  // Cookie-backed native requests must be same-origin. No CORS authorization.
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("x-cradlehub-native") !== "driver-v1" ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response({ ok: false, error: "Request origin not permitted." }, 403);
  }
  const size = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(size) || size > 1024) {
    return response({ ok: false, error: "Request too large." }, 413);
  }
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    return response({ ok: false, error: "Sign in to your Staff account." }, 401);
  }
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return response({ ok: false, error: "Invalid request." }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response({ ok: false, error: "Invalid request." }, 400);
  }
  const { bookingId, operation } = payload as Record<string, unknown>;
  if (typeof bookingId !== "string" || !ID.test(bookingId) ||
      (operation !== "start" && operation !== "arrive")) {
    return response({ ok: false, error: "Invalid trip action." }, 400);
  }
  const assigned = await getMyDriverJobByIdAction(bookingId);
  if ("error" in assigned) {
    return response({ ok: false, error: "Trip is unavailable to this driver." }, 403);
  }
  const { job, staff } = assigned;
  if (!(staff.system_role === "driver" || staff.staff_type === "driver") ||
      !staff.branch_id || job.driverId !== staff.id ||
      !["confirmed", "in_progress"].includes(job.bookingStatus)) {
    return response({ ok: false, error: "Driver assignment or booking not active." }, 409);
  }

  if (operation === "start") {
    if (!isValidDriverDestination(job)) {
      return response({ ok: false, error: "CRM must verify destination GPS." }, 422);
    }
    if (job.bookingProgressStatus === "travel_started" &&
        job.dispatchStatus === "in_route") {
      return response({ ok: true, bookingId, status: "travel_started" }, 200);
    }
    if (job.bookingProgressStatus !== "not_started") {
      return response({ ok: false, error: "Travel cannot start in this state." }, 409);
    }
  } else if (job.bookingProgressStatus !== "travel_started" ||
             job.dispatchStatus !== "in_route") {
    return response({ ok: false, error: "Trip is not actively travelling." }, 409);
  }

  // This existing action verifies branch, driver ID, booking state and
  // transition; its DB RPC repeats checks under row locks.
  const nextStatus = operation === "start" ? "travel_started" : "arrived";
  const result = await updateBookingProgressAction({ bookingId, nextStatus });
  if (!result.ok) {
    return response({ ok: false, error: result.message },
      result.code === "UNAUTHORIZED" ? 401 :
      result.code === "PERMISSION_DENIED" ? 403 :
      result.code === "DATABASE_ERROR" ? 503 : 409);
  }
  return response({ ok: true, bookingId, status: result.status }, 200);
}
