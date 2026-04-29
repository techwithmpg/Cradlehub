import { z } from "zod";

export const BOOKING_STATUS_VALUES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const updateBookingStatusSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  status: z.enum(BOOKING_STATUS_VALUES),
});
