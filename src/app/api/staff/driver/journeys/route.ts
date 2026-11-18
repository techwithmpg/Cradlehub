import { NextRequest } from "next/server";
import { z } from "zod";
import { readDriverJourneys, applyDriverEvent } from "@/lib/driver/server";
import { buildDriverTripPlans } from "@/lib/driver/trip-plans";
import { driverJson, driverError, readDriverBody, validDriverMutation } from "@/lib/driver/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("bookingId") ?? undefined;
    if (id && !z.guid().safeParse(id).success)
      return driverJson({ ok: false, message: "Invalid trip." }, 400);
    const journeys = await readDriverJourneys(id);
    const driverHint =
      journeys[0]?.viewerDriverId ??
      journeys[0]?.activeDriverId ??
      journeys[0]?.deliveryDriverId ??
      undefined;
    return driverJson({
      ok: true,
      journeys,
      tripPlans: buildDriverTripPlans(journeys, driverHint ?? undefined),
    });
  } catch (e) {
    return driverError(e);
  }
}
export async function POST(request: NextRequest) {
  if (!validDriverMutation(request))
    return driverJson({ ok: false, message: "Invalid origin or content type." }, 403);
  try {
    return driverJson({ ok: true, journey: await applyDriverEvent(await readDriverBody(request)) });
  } catch (e) {
    return driverError(e);
  }
}
