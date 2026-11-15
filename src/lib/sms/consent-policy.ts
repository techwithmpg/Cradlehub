import { smsPhoneE164, type SmsVisit } from "./policy";

export type SmsConsentChoice = "opt_in" | "opt_out";
export type BookingSmsConsent = {
  visit_key: string;
  customer_id: string;
  phone_e164: string;
  choice: SmsConsentChoice;
};

/** Require consent to this exact visit and current organizer phone. */
export function consentMatchesVisit(
  visit: SmsVisit,
  consent: BookingSmsConsent | null | undefined
): boolean {
  return (
    !!consent &&
    consent.choice === "opt_in" &&
    consent.visit_key === visit.key &&
    consent.customer_id === visit.customerId &&
    smsPhoneE164(visit.phone) === consent.phone_e164
  );
}

export function phoneMatchesConsentContact(submittedPhone: string, storedPhone: string): boolean {
  const submitted = smsPhoneE164(submittedPhone);
  return submitted !== null && submitted === smsPhoneE164(storedPhone);
}

export type PromotionalConsentSource = "public_booking" | "crm_booking";

export type PromotionalSmsConsentState = {
  opted_in: boolean;
  status: "opted_in" | "not_opted_in";
  scope: "marketing";
  consent_source: PromotionalConsentSource | null;
  phone_e164: string | null;
};

export type CustomerPromotionalPreference = {
  customer_id: string;
  consented_phone_e164: string | null;
  promotional_opt_in_at: string | null;
  promotional_consent_source: string | null;
  opted_out_at: string | null;
};

/**
 * Build deterministic promotional/marketing SMS consent metadata from an
 * explicit affirmative opt-in flag. Unchecked/falsy input NEVER creates opt-in.
 */
export function buildPromotionalSmsConsentMetadata(input: {
  explicitOptIn?: boolean | null;
  phone: string;
  source: PromotionalConsentSource;
}): PromotionalSmsConsentState {
  const phoneE164 = smsPhoneE164(input.phone);
  if (input.explicitOptIn === true && phoneE164) {
    return {
      opted_in: true,
      status: "opted_in",
      scope: "marketing",
      consent_source: input.source,
      phone_e164: phoneE164,
    };
  }
  return {
    opted_in: false,
    status: "not_opted_in",
    scope: "marketing",
    consent_source: null,
    phone_e164: null,
  };
}

/**
 * Promotional/marketing SMS eligibility guard.
 * Strictly separated from transactional booking consent (`booking_sms_consents`
 * and `transactional_opt_in_at`): transactional permission NEVER enables marketing.
 */
export function isPromotionalSmsPermitted(input: {
  phone: string;
  customerId: string;
  preference?: CustomerPromotionalPreference | null;
  bookingMetadataConsent?: Partial<PromotionalSmsConsentState> | null;
}): boolean {
  const e164 = smsPhoneE164(input.phone);
  if (!e164) return false;
  if (input.preference?.opted_out_at) return false;

  if (input.preference) {
    return (
      input.preference.customer_id === input.customerId &&
      input.preference.consented_phone_e164 === e164 &&
      Boolean(input.preference.promotional_opt_in_at) &&
      Boolean(input.preference.promotional_consent_source?.trim())
    );
  }

  return (
    input.bookingMetadataConsent?.opted_in === true &&
    input.bookingMetadataConsent?.status === "opted_in" &&
    input.bookingMetadataConsent?.scope === "marketing" &&
    input.bookingMetadataConsent?.phone_e164 === e164 &&
    Boolean(input.bookingMetadataConsent?.consent_source)
  );
}
