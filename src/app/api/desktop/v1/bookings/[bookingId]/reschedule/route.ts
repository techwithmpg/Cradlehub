import { z } from "zod";
import { rescheduleBooking, rescheduleBookingSchema } from "@/lib/bookings/crm-booking-operations";
import { isValidCalendarDate } from "@/lib/schedule/schedule-date";
import {
  withDesktopBookingContext,
  desktopFailure,
  bookingOperationResponse,
} from "@/lib/bookings/desktop-booking-contract";
const bodySchema = rescheduleBookingSchema.omit({ bookingId: true }).extend({
  date: z.string().refine(isValidCalendarDate),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
});
export async function POST(request: Request, route: { params: Promise<{ bookingId: string }> }) {
  return withDesktopBookingContext(request, async (ctx) => {
    const id = z.guid().safeParse((await route.params).bookingId);
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!id.success || !body.success)
      return desktopFailure(
        "VALIDATION_ERROR",
        "A valid booking, date and time are required.",
        400
      );
    return bookingOperationResponse(
      await rescheduleBooking(ctx, { ...body.data, bookingId: id.data })
    );
  });
}
