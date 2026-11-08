import { describe, expect, it } from "vitest";

import {
  appointmentMs, businessDate, isActiveUnstartedVisit, isSmsDue,
  smsDedupeKey, smsMessage, smsPhoneE164, type SmsVisit,
} from "./policy";

const original: SmsVisit = {
  key: "visit-1",
  bookingId: "booking-1",
  orderId: null,
  customerId: "customer-1",
  customerName: "Maria Santos",
  phone: "+639123456789",
  branchName: "Main Spa",
  serviceNames: ["Swedish Massage"],
  date: "2026-11-10",
  startTime: "15:00:00",
  homeService: false,
  statuses: ["confirmed"],
  progress: ["confirmed"],
  sessionStarted: false,
};

const at = (local: string) => new Date(local + "+08:00");

describe("CradleHub appointment SMS policy", () => {
  it("normalizes only valid Philippine mobiles without rewriting a foreign number", () => {
    expect(smsPhoneE164("0912 345 6789")).toBe("+639123456789");
    expect(smsPhoneE164("639123456789")).toBe("+639123456789");
    expect(smsPhoneE164("+63 912-345-6789")).toBe("+639123456789");
    expect(smsPhoneE164("+12025550123")).toBe(null);
    expect(smsPhoneE164("12345")).toBe(null);
  });

  it("interprets appointment times using Philippine business time", () => {
    expect(businessDate(at("2026-11-10T08:00:00"))).toBe("2026-11-10");
    expect(appointmentMs("2026-11-10", "15:00:00")).toBe(at("2026-11-10T15:00:00").getTime());
    expect(Number.isNaN(appointmentMs("2026-02-30", "15:00:00"))).toBe(true);
  });

  it("fails closed when any group line is pending, cancelled, checked in, or started", () => {
    expect(isActiveUnstartedVisit(original)).toBe(true);
    expect(isActiveUnstartedVisit({ ...original, statuses: ["confirmed", "pending"] })).toBe(false);
    expect(isActiveUnstartedVisit({ ...original, statuses: ["confirmed", "cancelled"] })).toBe(false);
    expect(isActiveUnstartedVisit({ ...original, progress: ["checked_in"] })).toBe(false);
    expect(isActiveUnstartedVisit({ ...original, sessionStarted: true })).toBe(false);
  });

  it("confirms only after a recent confirmation event, not at unconfirmed booking creation", () => {
    expect(isSmsDue("confirmation", original, at("2026-11-09T12:00:00"))).toBe(false);
    expect(isSmsDue("confirmation", original, at("2026-11-09T12:00:00"),
      "2026-11-09T11:59:00+08:00")).toBe(true);
    expect(isSmsDue("confirmation", original, at("2026-11-09T12:00:00"),
      "2026-11-09T08:00:00+08:00")).toBe(false);
  });

  it("sends the morning batch only on the appointment date with sufficient lead time", () => {
    expect(isSmsDue("morning", original, at("2026-11-10T08:00:00"))).toBe(true);
    expect(isSmsDue("morning", original, at("2026-11-09T08:00:00"))).toBe(false);
    expect(isSmsDue("morning", original, at("2026-11-10T07:59:00"))).toBe(false);
    expect(isSmsDue("morning", original, at("2026-11-10T12:01:00"))).toBe(false);
    expect(isSmsDue("morning", { ...original, startTime: "09:00:00" },
      at("2026-11-10T08:00:00"))).toBe(false);
  });

  it("sends the personalized reminder in a narrow window before service", () => {
    expect(isSmsDue("one_hour", original, at("2026-11-10T14:00:00"))).toBe(true);
    expect(isSmsDue("one_hour", original, at("2026-11-10T14:09:00"))).toBe(true);
    expect(isSmsDue("one_hour", original, at("2026-11-10T14:11:00"))).toBe(false);
    expect(isSmsDue("one_hour", original, at("2026-11-10T13:59:00"))).toBe(false);
    expect(isSmsDue("one_hour", original, at("2026-11-10T15:00:00"))).toBe(false);
  });

  it("uses a visit/event/time key to deduplicate group reminders", () => {
    expect(smsDedupeKey("morning", { ...original, bookingId: "booking-2" }))
      .toBe(smsDedupeKey("morning", original));
    expect(smsDedupeKey("one_hour", original)).not.toBe(smsDedupeKey("morning", original));
    expect(smsDedupeKey("one_hour", { ...original, startTime: "16:00:00" }))
      .not.toBe(smsDedupeKey("one_hour", original));
  });

  it("uses correct home-service wording without falsely promising driver ETA", () => {
    const home = { ...original, homeService: true };
    expect(smsMessage("one_hour", home)).toContain("home service");
    expect(smsMessage("one_hour", home)).not.toContain("arrive 10 minutes early");
    expect(smsMessage("one_hour", home)).not.toContain("driver");
  });

  it("uses safe service wording when service details are absent or malformed", () => {
    expect(smsMessage("confirmation", { ...original, serviceNames: [] }))
      .toContain("booked services");
    expect(smsMessage("one_hour", { ...original, serviceNames: [undefined] as unknown as string[] }))
      .toContain("Cradle Spa service");
  });

  it("does not expose a message URL or include internal booking details", () => {
    const message = smsMessage("one_hour", original);
    expect(message).toContain("Swedish Massage");
    expect(message).toContain("3:00 PM");
    expect(message).not.toContain("http");
    expect(message).not.toContain("customer-1");
    expect(message.length).toBeLessThanOrEqual(320);
  });
});
