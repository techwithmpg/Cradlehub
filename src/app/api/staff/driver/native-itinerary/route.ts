import { NextRequest, NextResponse } from "next/server";
import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";
import { isValidDriverDestination } from "@/lib/staff-pwa/driver-dispatch-policy";

export const runtime = "nodejs";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/**
 * Native Android driver companion itinerary read.
 * Uses the SAME authenticated server-side driver/branch/booking lookup as the
 * Staff PWA; an untrusted booking ID never conveys location authority.
 *
 * Initial native foundation is deliberately ONE actively travelling stop.
 * It does not release upcoming stops or auto-complete a booking. Multi-stop
 * navigation after service completion requires a separate dispatch policy.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("bookingId");
  if (!id || !ID.test(id)) {
    return privateJson({ ok: false, error: "Invalid trip reference." }, 400);
  }

  const assigned = await getMyDriverJobByIdAction(id);
  if ("error" in assigned) {
    return privateJson({ ok: false, error: "Trip not available to this driver." }, 403);
  }
  const { job, staff } = assigned;
  const driverRole = staff.system_role === "driver" || staff.staff_type === "driver";
  if (!driverRole || !staff.branch_id || job.driverId !== staff.id ||
      job.bookingProgressStatus !== "travel_started" ||
      !["confirmed", "in_progress"].includes(job.bookingStatus) ||
      job.dispatchStatus !== "in_route") {
    return privateJson({ ok: false, error: "Start travel in CradleHub first." }, 409);
  }
  if (!isValidDriverDestination(job)) {
    return privateJson({ ok: false, error: "CRM must verify the customer destination." }, 422);
  }

  return privateJson({
    ok: true,
    bookingId: job.id,
    stops: [{
      bookingId: job.id,
      lat: job.lat,
      lng: job.lng,
      title: "Home Service destination",
    }],
    // This response is read only. Position, arrival and status writes MUST go
    // through separate server-authorized operations with evidence checks.
  }, 200);
}
