import { describe, expect, it } from "vitest";
import {
  createOnlineBookingSchema,
  createOnlineBookingMultiSchema,
  createWalkinBookingSchema,
} from "./booking";

const branchId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";
// More than a day ahead so the date is valid in multiple test timezones.
const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const base = {
  branchId,
  date,
  startTime: "14:00",
  fullName: "Test Customer",
};

describe("server-side public booking phone boundary", () => {
  const schemas = [
    ["legacy single-service", createOnlineBookingSchema, { serviceId }],
    ["multi-service / group", createOnlineBookingMultiSchema, { serviceIds: [serviceId] }],
  ] as const;

  for (const [name, schema, fields] of schemas) {
    it.each(["09123456789", "+639123456789", "639123456789", "0912 345 6789"])(
      `${name} accepts Philippine mobile: %s`,
      (phone) => {
        const result = schema.safeParse({ ...base, ...fields, phone });
        expect(result.success).toBe(true);
      }
    );

    it.each(["+12345678901", "+237612345678", "08123456789", "0912345678", ""])(
      `${name} rejects foreign, malformed, and missing phone: %s`,
      (phone) => {
        const result = schema.safeParse({ ...base, ...fields, phone });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path[0] === "phone")).toBe(true);
        }
      }
    );
  }

  it("keeps existing CRM/manual booking phone rules unchanged", () => {
    const result = createWalkinBookingSchema.safeParse({
      serviceId,
      staffId,
      date,
      startTime: "14:00",
      fullName: "Staff-entered International Guest",
      phone: "+237612345678",
    });
    expect(result.success).toBe(true);
  });
});
