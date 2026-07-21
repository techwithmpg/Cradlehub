import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isConsultationOnlyService } from "@/lib/bookings/consultation-only-service";
import {
  createOnlineBookingMultiSchema,
  createOnlineBookingSchema,
} from "@/lib/validations/booking";

const validSingle = {
  website: "",
  branchId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  startTime: "10:00",
  fullName: "Test Guest",
  phone: "+63 900 000 0000",
};

describe("public release hardening contracts", () => {
  it("keeps ordinary single-person services automatically bookable", () => {
    expect(isConsultationOnlyService({ name: "Swedish Massage", categoryName: "Massage" })).toBe(false);
    expect(createOnlineBookingSchema.safeParse(validSingle).success).toBe(true);
  });

  it("classifies couples, besties, parties, and configured services as consultation only", () => {
    expect(isConsultationOnlyService({ name: "Couples Massage" })).toBe(true);
    expect(isConsultationOnlyService({ name: "Heavenly Harmony Besties Spa" })).toBe(true);
    expect(isConsultationOnlyService({ name: "Alexandrite", categoryName: "Spa Party Packages" })).toBe(true);
    expect(isConsultationOnlyService({ name: "Private Ritual", metadata: { requires_consultation: true } })).toBe(true);
  });

  it("rejects honeypot and unknown booking fields while accepting an empty honeypot", () => {
    expect(createOnlineBookingSchema.safeParse({ ...validSingle, website: "spam" }).success).toBe(false);
    expect(createOnlineBookingSchema.safeParse({ ...validSingle, unexpected: true }).success).toBe(false);
    expect(createOnlineBookingMultiSchema.safeParse({
      ...validSingle,
      serviceIds: [validSingle.serviceId],
      serviceId: undefined,
    }).success).toBe(false);
  });

  it("enforces consultation and duplicate checks before automatic assignment", () => {
    const action = readFileSync("src/lib/actions/online-booking.ts", "utf8");
    const publicActionBody = action.slice(action.indexOf("export async function createOnlineBookingAction"));
    expect(publicActionBody.indexOf("containsConsultationOnlyService")).toBeLessThan(
      publicActionBody.indexOf("assignTherapistBySeniority")
    );
    expect(action).toContain("DUPLICATE_REQUEST");
    expect(action).toContain("MAX_PUBLIC_BOOKING_PAYLOAD_BYTES");
  });

  it("keeps CRM manual booking separate from public consultation enforcement", () => {
    const inhouse = readFileSync("src/lib/actions/inhouse-booking.ts", "utf8");
    expect(inhouse).not.toContain("CONSULTATION_REQUIRED");
    expect(inhouse).toContain("MANUAL_ARRANGEMENT_REQUIRED");
    expect(inhouse).toContain("selected provider is only the coordinator");
  });

  it("protects the waitlist route without exposing database messages", () => {
    const route = readFileSync("src/app/api/public/waitlist/route.ts", "utf8");
    expect(route).toContain("MAX_WAITLIST_PAYLOAD_BYTES");
    expect(route).toContain("WAITLIST_COOLDOWN_MS");
    expect(route).toContain("website:");
    expect(route).not.toContain("{ error: error.message }");
  });
});
