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

/** Only report a foreign prefix once the user has typed enough to rule out +63. */
export function isClearlyForeignMobilePrefix(value: string): boolean {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) {
    return compact.length > 1 && !"+63".startsWith(compact) && !compact.startsWith("+63");
  }
  return /^00\d{2}/.test(compact);
}

export function getPhilippineMobileNumberError(value: string): string | null {
  if (!value.trim()) return REQUIRED_PH_MOBILE_MESSAGE;
  if (isValidPhilippineMobileNumber(value)) return null;
  if (isClearlyForeignMobilePrefix(value)) return FOREIGN_MOBILE_MESSAGE;
  return INVALID_PH_MOBILE_MESSAGE;
}

/**
 * Public international contact fallback. E.164 syntax is accepted for manual
 * callback; it does not prove the number is reachable or that Twilio can send
 * to the destination. Foreign contacts must also supply an email address.
 */
export const INTERNATIONAL_MOBILE_FORMAT_MESSAGE =
  "Enter the international number with + and its country code (8–15 digits), or use a Philippine mobile number.";
export const INTERNATIONAL_EMAIL_REQUIRED_MESSAGE =
  "Please include an email address for an international number so Cradle can contact you if calling or SMS is unavailable.";

export function isValidInternationalContactNumber(value: string): boolean {
  const compact = value.trim().replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact) && !compact.startsWith("+63");
}

export function isValidPublicContactNumber(value: string): boolean {
  return isValidPhilippineMobileNumber(value) || isValidInternationalContactNumber(value);
}

export function needsInternationalEmailFallback(value: string): boolean {
  return isValidInternationalContactNumber(value);
}

export function getPublicContactNumberError(value: string): string | null {
  if (isValidPublicContactNumber(value)) return null;
  if (isClearlyForeignMobilePrefix(value)) return INTERNATIONAL_MOBILE_FORMAT_MESSAGE;
  return getPhilippineMobileNumberError(value);
}

/**
 * User-facing feedback for the public contact field. Computed on every value
 * change; no blur or attempted submission is needed to see an invalid number.
 */
export function getPublicPhoneFieldFeedback(value: string): {
  status: "hint" | "error" | "valid";
  message: string;
} {
  if (!value.trim()) {
    return {
      status: "hint",
      message: "Enter a Philippine mobile number (09 or +63) or an international number (+country code). International contacts also need email.",
    };
  }

  const error = getPublicContactNumberError(value);
  if (error) return { status: "error", message: error };

  return {
    status: "valid",
    message: needsInternationalEmailFallback(value)
      ? "International number accepted for callback. Email is also required; SMS delivery is not guaranteed."
      : "Philippine mobile number format accepted.",
  };
}
