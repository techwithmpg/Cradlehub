import { describe, expect, it } from "vitest";
import { createInhouseBookingMultiSchema } from "@/lib/validations/booking";

const serviceA = "33333333-3333-4333-8333-333333333333";
const serviceB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const attendeeA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const attendeeB = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const base = { serviceIds: [serviceA], date: "2026-10-15", startTime: "14:00",
  type: "walkin", fullName: "Malcolm Owner", phone: "09171234567" };
const group = { ...base, bookingFor: "me_and_others", serviceIds: [serviceA, serviceB], attendees: [
  { id: attendeeA, name: "Malcolm Owner", isOrganizer: true, serviceIds: [serviceA] },
  { id: attendeeB, name: "Anna Guest", isOrganizer: false, serviceIds: [serviceB] },
] };

describe("CRM-MB1 input contract", () => {
  it("preserves single-person input and accepts bounded guest associations", () => {
    expect(createInhouseBookingMultiSchema.safeParse(base).success).toBe(true);
    expect(createInhouseBookingMultiSchema.safeParse(group).success).toBe(true);
  });

  it("rejects missing services, duplicate identities and mismatched organizer", () => {
    expect(createInhouseBookingMultiSchema.safeParse({ ...group, attendees: [
      group.attendees[0], { ...group.attendees[1], serviceIds: [] },
    ] }).success).toBe(false);
    expect(createInhouseBookingMultiSchema.safeParse({ ...group, attendees: [
      group.attendees[0], { ...group.attendees[1], id: attendeeA },
    ] }).success).toBe(false);
    expect(createInhouseBookingMultiSchema.safeParse({ ...group, attendees: [
      { ...group.attendees[0], name: "Other Name" }, group.attendees[1],
    ] }).success).toBe(false);
  });

  it("rejects client-supplied authoritative values", () => {
    expect(createInhouseBookingMultiSchema.safeParse({ ...group, totalPrice: 1 }).success).toBe(false);
    expect(createInhouseBookingMultiSchema.safeParse({ ...group, staffAssignments: ["fake"] }).success).toBe(false);
  });
});
