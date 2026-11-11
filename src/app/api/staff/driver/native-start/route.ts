import { NextRequest, NextResponse } from "next/server";
import {
  getMyDriverJobByIdAction,
  updateBookingProgressAction,
} from "@/app/(dashboard)/staff-portal/actions";
import { isValidDriverDestination } from "@/lib/staff-pwa/driver-dispatch-policy";

export const runtime = "nodejs";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Only a driver's deliberate native Start tap calls this mutation.
 * The existing locked booking-progress RPC remains the source of truth.
 */
export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) return privateJson({ ok: false, error: "Invalid navigation request." }, 403);

  let body: unknown;
  try { body = await request.json(); }
  catch { return privateJson({ ok: false, error: "Invalid request." }, 400); }
  const id = body && typeof body === "object" && "bookingId" in body
    ? (body as { bookingId: unknown }).bookingId : null;
  if (typeof id !== "string" || !ID.test(id)) {
    return privateJson({ ok: false, error: "Invalid trip reference." }, 400);
  }

  const assigned = await getMyDriverJobByIdAction(id);
  if ("error" in assigned) {
    return privateJson({ ok: false, error: "Trip is unavailable." }, 403);
  }
  const { staff, job } = assigned;
  if (!(staff.system_role === "driver" || staff.staff_type === "driver") ||
      !staff.branch_id || job.driverId !== staff.id ||
      !["confirmed", "in_progress"].includes(job.bookingStatus) ||
      !isValidDriverDestination(job)) {
    return privateJson({ ok: false, error: "Trip cannot be started." }, 409);
  }

  // Idempotent on reconnect, but never permit a stale/cancelled assignment.
  if (job.bookingProgressStatus === "travel_started" && job.dispatchStatus === "in_route") {
    return privateJson({ ok: true, bookingId: id }, 200);
  }
  if (job.bookingProgressStatus !== "not_started" || job.dispatchStatus !== "ready") {
    return privateJson({ ok: false, error: "Trip state changed." }, 409);
  }

  // Server action and database RPC independently recheck actor, branch,
  // assignment, status and allowed transition under the booking row lock.
  const result = await updateBookingProgressAction({
    bookingId: id,
    nextStatus: "travel_started",
  });
  if (!result.ok) return privateJson({ ok: false, error: "Trip could not start." }, 409);
  return privateJson({ ok: true, bookingId: id }, 200);
}
