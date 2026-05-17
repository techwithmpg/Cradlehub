export const PUBLIC_BOOKING_HOLD_MINUTES = 120;

const NON_BLOCKING_BOOKING_STATUSES = new Set(["cancelled", "no_show", "expired"]);
const HOLD_BLOCKING_BOOKING_STATUSES = new Set([
  "pending_payment",
  "pending_crm_confirmation",
]);
const ALWAYS_BLOCKING_BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
]);

type BookingHoldState = {
  status?: string | null;
  hold_expires_at?: string | null;
};

export function getPublicBookingHoldExpiresAt(now = new Date()): string {
  return new Date(
    now.getTime() + PUBLIC_BOOKING_HOLD_MINUTES * 60 * 1000
  ).toISOString();
}

export function bookingBlocksAvailability(
  booking: BookingHoldState,
  now = new Date()
): boolean {
  const status = booking.status ?? "";

  if (NON_BLOCKING_BOOKING_STATUSES.has(status)) return false;

  if (HOLD_BLOCKING_BOOKING_STATUSES.has(status)) {
    if (!booking.hold_expires_at) return false;

    const holdExpiresAt = new Date(booking.hold_expires_at).getTime();
    return Number.isFinite(holdExpiresAt) && holdExpiresAt > now.getTime();
  }

  return ALWAYS_BLOCKING_BOOKING_STATUSES.has(status);
}
