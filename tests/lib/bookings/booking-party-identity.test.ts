import { describe, expect, it } from "vitest";
import { resolveBookingPartyIdentity } from "@/lib/bookings/booking-party-identity";

describe("booking party roles for CRM", () => {
  it("distinguishes guest treatment from the main person who booked", () => {
    expect(resolveBookingPartyIdentity({
      bookedBy: "Main Booker",
      serviceRecipient: "Guest Recipient",
    })).toEqual({
      bookedBy: "Main Booker",
      serviceFor: "Guest Recipient",
      isGuest: true,
      roleLabel: "Guest",
    });
  });

  it("marks the booker's own treatment and does not invent group membership", () => {
    expect(resolveBookingPartyIdentity({
      bookedBy: "Main Booker",
      serviceRecipient: "main booker",
    })).toMatchObject({ isGuest: false, roleLabel: "Booker & recipient" });
  });

  it("handles missing or legacy recipient without changing payment identity", () => {
    expect(resolveBookingPartyIdentity({
      bookedBy: "Main Booker",
      serviceRecipient: " ",
    })).toMatchObject({ serviceFor: "Main Booker", isGuest: false });
    expect(resolveBookingPartyIdentity({
      bookedBy: null,
      serviceRecipient: "Guest Recipient",
    })).toMatchObject({ bookedBy: null, serviceFor: "Guest Recipient", isGuest: false });
  });
});
