"use server";

import { updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import { markBookingConfirmedAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { BookingOperationResult } from "@/lib/bookings/crm-booking-operations";

export async function updateWorkQueueBookingStatusAction(
  rawInput: unknown
): Promise<BookingOperationResult> {
  const input = rawInput as { bookingId?: unknown; status?: unknown; notes?: unknown } | null;

  if (input?.status === "confirmed") {
    return markBookingConfirmedAction({
      bookingId: input.bookingId,
      note: typeof input.notes === "string" ? input.notes : undefined,
    });
  }

  return updateBookingStatusAction(rawInput);
}
