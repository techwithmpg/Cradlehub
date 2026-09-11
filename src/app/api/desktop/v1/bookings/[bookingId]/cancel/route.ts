import { z } from "zod";
import { recordBookingFollowup } from "@/lib/bookings/crm-booking-operations";
import { BOOKING_CANCELLATION_REASON_VALUES } from "@/lib/bookings/cancellation-reasons";
import {
  withDesktopBookingContext,
  desktopFailure,
  bookingOperationResponse,
} from "@/lib/bookings/desktop-booking-contract";
const schema = z.object({
  cancellationReason: z.enum(BOOKING_CANCELLATION_REASON_VALUES).optional(),
  note: z.string().max(500).optional(),
});
export async function POST(request: Request, route: { params: Promise<{ bookingId: string }> }) {
  return withDesktopBookingContext(request, async (ctx) => {
    const id = z.guid().safeParse((await route.params).bookingId);
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!id.success || !body.success)
      return desktopFailure("VALIDATION_ERROR", "Invalid booking cancellation payload.", 400);
    return bookingOperationResponse(
      await recordBookingFollowup(ctx, { ...body.data, bookingId: id.data, result: "cancel" })
    );
  });
}
