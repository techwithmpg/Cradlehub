import { z } from "zod";
import {
  confirmCrmBooking,
  markCrmBookingArrived,
  startCrmBookingService,
  completeCrmBookingService,
} from "@/lib/bookings/crm-booking-operations";
import {
  withDesktopBookingContext,
  desktopFailure,
  bookingOperationResponse,
} from "@/lib/bookings/desktop-booking-contract";

const todayMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm_booking"),
    bookingId: z.guid("Invalid booking identifier."),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("mark_arrived"),
    bookingId: z.guid("Invalid booking identifier."),
  }),
  z.object({
    action: z.literal("start_service"),
    bookingId: z.guid("Invalid booking identifier."),
  }),
  z.object({
    action: z.literal("complete_service"),
    bookingId: z.guid("Invalid booking identifier."),
  }),
]);

/**
 * POST /api/desktop/v1/today/mutations
 *
 * Executes authorized operational mutations for the Today module:
 * - confirm_booking
 * - mark_arrived
 * - start_service
 * - complete_service
 *
 * Payment mutations (collect_payment, confirm_payment, update_payment)
 * and dormant workflows (cancel, reschedule, dispatch) are strictly excluded.
 */
export async function POST(request: Request) {
  return withDesktopBookingContext(request, async (ctx) => {
    const rawBody = await request.json().catch(() => null);
    const parsed = todayMutationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return desktopFailure(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid mutation payload.",
        400
      );
    }

    const input = parsed.data;
    switch (input.action) {
      case "confirm_booking":
        return bookingOperationResponse(await confirmCrmBooking(ctx, input));
      case "mark_arrived":
        return bookingOperationResponse(await markCrmBookingArrived(ctx, input));
      case "start_service":
        return bookingOperationResponse(await startCrmBookingService(ctx, input));
      case "complete_service":
        return bookingOperationResponse(await completeCrmBookingService(ctx, input));
    }
  });
}
