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
