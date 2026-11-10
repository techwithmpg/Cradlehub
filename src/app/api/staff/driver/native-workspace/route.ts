import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyDriverAllJobsAction } from "@/app/(dashboard)/staff-portal/actions";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Cookie",
  }});
}

/** Minimal, scoped driver-only native transport. Not a new booking engine. */
function toMobileTrip(job: RealDispatchItem) {
  return {
    id: job.id,
    customerName: job.customerName,
    serviceName: job.serviceName,
    bookingDate: job.bookingDate,
    startTime: job.startTime,
    bookingStatus: job.bookingStatus,
    bookingProgressStatus: job.bookingProgressStatus,
    dispatchStatus: job.dispatchStatus,
    destination: job.formattedAddress ?? job.area ?? null,
    destinationReady: !job.needsLocationReview && job.lat !== null &&
      job.lng !== null && Number.isFinite(job.lat) && Number.isFinite(job.lng) &&
      Math.abs(job.lat) <= 90 && Math.abs(job.lng) <= 180,
  };
}

export async function GET(_request: NextRequest) {
  if (process.env.NATIVE_DRIVER_CONNECTED_ENABLED !== "true") {
    return privateJson({ ok: false, error: "Driver TEST connection is not enabled on this server." }, 503);
  }

  // getUser validates the server session, not a client-supplied profile.
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return privateJson({ ok: false, error: "Sign in to your Staff account." }, 401);
  }
  const result = await getMyDriverAllJobsAction();
  if ("error" in result) {
    return privateJson({ ok: false, error: "Driver workspace unavailable." },
      result.error === "Unauthorized" ? 403 : 503);
  }
  const { staff } = result;
  if (!staff.branch_id || !(staff.system_role === "driver" || staff.staff_type === "driver")) {
    return privateJson({ ok: false, error: "Driver access required." }, 403);
  }
  const byId = new Map([...result.today, ...result.recent].map(item => [item.id, item]));
  const items = [...byId.values()].filter(item => item.driverId === staff.id)
    .map(toMobileTrip);
  return privateJson({
    ok: true,
    name: staff.nickname?.trim() || staff.full_name?.trim() || "Driver",
    businessDate: result.businessDate,
    trips: items,
  }, 200);
}
