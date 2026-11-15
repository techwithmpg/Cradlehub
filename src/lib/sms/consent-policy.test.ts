import { describe, expect, it } from "vitest";
import {
  buildPromotionalSmsConsentMetadata,
  consentMatchesVisit,
  isPromotionalSmsPermitted,
  phoneMatchesConsentContact,
} from "./consent-policy";
import type { SmsVisit } from "./policy";

const visit: SmsVisit = {
  key: "visit-one",
  bookingId: "booking-one",
  orderId: "visit-one",
  customerId: "customer-one",
  customerName: "Test Customer",
  phone: "09123456789",
  branchName: "Main",
  serviceNames: ["Massage"],
  date: "2026-11-30",
  startTime: "14:00:00",
  homeService: false,
  statuses: ["confirmed"],
  progress: [null],
  sessionStarted: false,
};
const consent = {
  visit_key: visit.key,
  customer_id: visit.customerId,
  phone_e164: "+639123456789",
  choice: "opt_in" as const,
};

describe("visit-scoped customer SMS consent", () => {
  it("requires explicit matching visit/customer/phone consent", () => {
    expect(consentMatchesVisit(visit, consent)).toBe(true);
    expect(consentMatchesVisit(visit, null)).toBe(false);
    expect(consentMatchesVisit(visit, { ...consent, choice: "opt_out" })).toBe(false);
    expect(consentMatchesVisit(visit, { ...consent, visit_key: "another-visit" })).toBe(false);
    expect(consentMatchesVisit(visit, { ...consent, customer_id: "another-customer" })).toBe(false);
    expect(consentMatchesVisit(visit, { ...consent, phone_e164: "+639999999999" })).toBe(false);
  });
  it("does not record for a mismatched or foreign contact", () => {
    expect(phoneMatchesConsentContact("0912 345 6789", "+639123456789")).toBe(true);
    expect(phoneMatchesConsentContact("09123456789", "09999999999")).toBe(false);
    expect(phoneMatchesConsentContact("+12025550123", "+12025550123")).toBe(false);
    expect(phoneMatchesConsentContact("", "09123456789")).toBe(false);
  });

  it("never enables marketing messages from unchecked consent or transactional-only permission", () => {
    const unchecked = buildPromotionalSmsConsentMetadata({
      explicitOptIn: false,
      phone: "09123456789",
      source: "public_booking",
    });
    expect(unchecked).toEqual({
      opted_in: false,
      status: "not_opted_in",
      scope: "marketing",
      consent_source: null,
      phone_e164: null,
    });
    expect(
      isPromotionalSmsPermitted({
        phone: "09123456789",
        customerId: "customer-one",
        bookingMetadataConsent: unchecked,
      })
    ).toBe(false);

    // Transactional preference row without explicit promotional opt-in must fail closed for marketing
    expect(
      isPromotionalSmsPermitted({
        phone: "09123456789",
        customerId: "customer-one",
        preference: {
          customer_id: "customer-one",
          consented_phone_e164: "+639123456789",
          promotional_opt_in_at: null,
          promotional_consent_source: null,
          opted_out_at: null,
        },
      })
    ).toBe(false);
  });

  it("permits promotional messaging only with explicit opt-in, matching phone/customer, and no global opt-out", () => {
    const checked = buildPromotionalSmsConsentMetadata({
      explicitOptIn: true,
      phone: "0912 345 6789",
      source: "public_booking",
    });
    expect(checked).toEqual({
      opted_in: true,
      status: "opted_in",
      scope: "marketing",
      consent_source: "public_booking",
      phone_e164: "+639123456789",
    });
    expect(
      isPromotionalSmsPermitted({
        phone: "09123456789",
        customerId: "customer-one",
        bookingMetadataConsent: checked,
      })
    ).toBe(true);

    // Global opt-out blocks promotional messaging even with affirmative metadata
    expect(
      isPromotionalSmsPermitted({
        phone: "09123456789",
        customerId: "customer-one",
        preference: {
          customer_id: "customer-one",
          consented_phone_e164: "+639123456789",
          promotional_opt_in_at: "2026-11-16T00:00:00Z",
          promotional_consent_source: "public_booking",
          opted_out_at: "2026-11-16T01:00:00Z",
        },
        bookingMetadataConsent: checked,
      })
    ).toBe(false);
  });
});
