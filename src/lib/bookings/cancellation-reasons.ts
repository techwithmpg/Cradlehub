export const BOOKING_CANCELLATION_REASONS = [
  { value: "customer_requested", label: "Customer requested cancellation" },
  { value: "customer_unavailable", label: "Customer unavailable" },
  { value: "duplicate_booking", label: "Duplicate booking" },
  { value: "scheduling_conflict", label: "Scheduling conflict" },
  { value: "staff_unavailable", label: "Staff unavailable" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "invalid_booking", label: "Invalid booking" },
  { value: "other", label: "Other" },
] as const;

export const BOOKING_CANCELLATION_REASON_VALUES = [
  "customer_requested",
  "customer_unavailable",
  "duplicate_booking",
  "scheduling_conflict",
  "staff_unavailable",
  "payment_issue",
  "invalid_booking",
  "other",
] as const;

export type BookingCancellationReason =
  (typeof BOOKING_CANCELLATION_REASON_VALUES)[number];

export function getBookingCancellationReasonLabel(
  reason: BookingCancellationReason
): string {
  return (
    BOOKING_CANCELLATION_REASONS.find((option) => option.value === reason)?.label ??
    "Other"
  );
}
