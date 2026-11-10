import { describe, expect, it } from "vitest";
import {
  createOnlineBookingSchema,
  createOnlineBookingMultiSchema,
  createInhouseBookingMultiSchema,
} from "@/lib/validations/booking";
import { INTERNATIONAL_EMAIL_REQUIRED_MESSAGE } from "@/lib/bookings/philippine-mobile";

const guid = "00000000-0000-4000-8000-000000000001";
const anotherGuid = "00000000-0000-4000-8000-000000000002";
const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

const core = {
  branchId: guid,
  date: tomorrow,
  startTime: "14:00",
  fullName: "International Customer",
  phone: "+237612345678",
};

describe("public international booking contact contracts", () => {
  it.each([
    ["single", createOnlineBookingSchema, { ...core, serviceId: anotherGuid }],
    ["group/multi", createOnlineBookingMultiSchema, { ...core, serviceIds: [anotherGuid] }],
  ])("%s requires an email fallback for international contacts", (_name, schema, payload) => {
    const withoutEmail = schema.safeParse(payload);
    expect(withoutEmail.success).toBe(false);
    if (!withoutEmail.success) {
      expect(withoutEmail.error.issues.some((issue) =>
        issue.path[0] === "email" && issue.message === INTERNATIONAL_EMAIL_REQUIRED_MESSAGE
      )).toBe(true);
    }
    expect(schema.safeParse({ ...payload, email: "customer@example.com" }).success).toBe(true);
  });

  it("preserves the Philippines-only option without forcing email", () => {
    expect(createOnlineBookingMultiSchema.safeParse({
      ...core,
      serviceIds: [anotherGuid],
      phone: "09123456789",
    }).success).toBe(true);
  });

  it("does not broaden CRM booking authorization or mutate its phone policy", () => {
    const result = createInhouseBookingMultiSchema.safeParse({
      branchId: guid,
      serviceIds: [anotherGuid],
      date: tomorrow,
      startTime: "14:00",
      fullName: "Manual Callback",
      phone: "+237612345678",
      crmBookingMode: "phone",
    });
    expect(result.success).toBe(true);
  });
});
