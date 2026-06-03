export const CRM_PENDING_BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "pending_crm_confirmation",
] as const;

export const CRM_OPERATIONAL_BOOKING_STATUSES = [
  ...CRM_PENDING_BOOKING_STATUSES,
  "confirmed",
  "in_progress",
] as const;

const CRM_PENDING_STATUS_SET = new Set<string>([...CRM_PENDING_BOOKING_STATUSES]);
const CRM_OPERATIONAL_STATUS_SET = new Set<string>([...CRM_OPERATIONAL_BOOKING_STATUSES]);

export function isCrmPendingBookingStatus(status: string): boolean {
  return CRM_PENDING_STATUS_SET.has(status);
}

export function isCrmOperationalBookingStatus(status: string): boolean {
  return CRM_OPERATIONAL_STATUS_SET.has(status);
}

export function isBookingClosedForCrm(status: string): boolean {
  return status === "cancelled" || status === "no_show" || status === "expired";
}
