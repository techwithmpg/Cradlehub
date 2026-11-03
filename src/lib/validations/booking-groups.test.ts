import { describe, expect, it } from "vitest";
import { createInhouseBookingMultiSchema, createOnlineBookingMultiSchema } from "./booking";

const serviceA = "00000000-0000-4000-8000-000000000001";
const serviceB = "00000000-0000-4000-8000-000000000002";
const branchId = "00000000-0000-4000-8000-000000000003";
const guestId = (index: number) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`;
const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function guests(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: guestId(index),
    name: index === 0 ? "Group Organizer" : `Guest ${index + 1}`,
    isOrganizer: index === 0,
    serviceIds: [serviceA, serviceB],
    serviceLines: [{ serviceId: serviceA }, { serviceId: serviceB }],
  }));
}

describe("booking group input", () => {
  it.each([1, 4, 5, 10, 11, 20, 25, 50])("accepts %i named guests with two services each", (count) => {
    const attendees = guests(count);
    const bookingFor = count === 1 ? "me" : "me_and_others";
    const common = {
      branchId,
      serviceIds: [serviceA, serviceB],
      attendees,
      bookingFor,
      date,
      startTime: "10:00",
      fullName: "Group Organizer",
      phone: "+639123456789",
    };
    expect(createInhouseBookingMultiSchema.safeParse(common).success).toBe(true);
    expect(createOnlineBookingMultiSchema.safeParse(common).success).toBe(true);
  });

  it("rejects duplicate guest IDs and unnamed recipients", () => {
    const attendees = guests(5);
    attendees[4]!.id = attendees[3]!.id;
    attendees[2]!.name = "";
    const common = {
      branchId,
      serviceIds: [serviceA, serviceB],
      attendees,
      bookingFor: "me_and_others",
      date,
      startTime: "10:00",
      fullName: "Group Organizer",
      phone: "+639123456789",
    };
    expect(createInhouseBookingMultiSchema.safeParse(common).success).toBe(false);
    expect(createOnlineBookingMultiSchema.safeParse(common).success).toBe(false);
  });
});
