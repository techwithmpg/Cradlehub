export const BOOKINGS_CHANGED_EVENT = "cradlehub:bookings-changed";

export function notifyBookingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));
}
