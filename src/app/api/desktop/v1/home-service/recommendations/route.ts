import { z } from "zod";
import {
  buildRecommendationContext,
  buildDriverRecommendationContext,
} from "@/lib/queries/assignment-recommendations";
import {
  scoreTherapistCandidates,
  scoreDriverCandidates,
} from "@/lib/assignments/recommendation-engine";
import {
  withDesktopBookingContext,
  checkDesktopBooking,
  desktopFailure,
  desktopJson,
} from "@/lib/bookings/desktop-booking-contract";
export async function GET(request: Request) {
  return withDesktopBookingContext(request, async (ctx) => {
    const parsed = z.guid().safeParse(new URL(request.url).searchParams.get("bookingId"));
    if (!parsed.success)
      return desktopFailure("VALIDATION_ERROR", "A valid bookingId is required.", 400);
    const rejected = await checkDesktopBooking(ctx, parsed.data, true);
    if (rejected) return rejected;
    const options = { supabase: ctx.supabase, throwOnError: true, branchId: ctx.me.branch_id };
    const [therapists, drivers] = await Promise.all([
      buildRecommendationContext(parsed.data, {}, options),
      buildDriverRecommendationContext(parsed.data, {}, options),
    ]);
    if (!therapists || !drivers)
      return desktopFailure(
        "BOOKING_NOT_FOUND",
        "Booking recommendation context is unavailable.",
        404
      );
    return desktopJson({
      ok: true,
      data: {
        therapists: scoreTherapistCandidates(therapists),
        drivers: scoreDriverCandidates(drivers),
      },
    });
  });
}
