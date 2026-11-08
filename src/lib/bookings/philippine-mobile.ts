/**
 * Public booking contact policy: a callable Philippine mobile number is required.
 * Format validation cannot prove the number is active or belongs to the customer.
 * Do not reuse this policy for staff-entered CRM/manual bookings.
 */
export const FOREIGN_MOBILE_MESSAGE =
  "International numbers are not accepted. Please enter a Philippine mobile number (+63) that our team can contact about your booking.";

export const INVALID_PH_MOBILE_MESSAGE =
  "Please enter a valid Philippine mobile number, such as 0912 345 6789.";

export const REQUIRED_PH_MOBILE_MESSAGE =
  "Please enter a Philippine mobile number that our team can contact.";

export function isValidPhilippineMobileNumber(value: string): boolean {
  // Allow common visual separators but never change the actual country code.
  const compact = value.trim().replace(/[\s()-]/g, "");
  return /^(?:09\d{9}|639\d{9}|\+639\d{9})$/.test(compact);
}

export function getPhilippineMobileNumberError(value: string): string | null {
  if (!value.trim()) return REQUIRED_PH_MOBILE_MESSAGE;
  if (isValidPhilippineMobileNumber(value)) return null;

  const compact = value.trim().replace(/[\s()-]/g, "");
  if ((compact.startsWith("+") && !compact.startsWith("+63")) || compact.startsWith("00")) {
    return FOREIGN_MOBILE_MESSAGE;
  }

  return INVALID_PH_MOBILE_MESSAGE;
}
