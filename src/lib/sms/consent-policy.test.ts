import { describe, expect, it } from "vitest";
import { consentMatchesVisit, phoneMatchesConsentContact } from "./consent-policy";
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
});
