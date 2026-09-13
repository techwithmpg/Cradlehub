import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeCrmBookingInput } from "@/lib/bookings/inhouse-booking-engine";
import {
  createOnlineBookingSchema,
  createOnlineBookingMultiSchema,
} from "@/lib/validations/booking";

describe("Front-desk CRM booking time normalization", () => {
  it.each([
    ["7 PM", "19:00:00"],
    ["7PM", "19:00:00"],
    ["7:30 PM", "19:30:00"],
    ["7:30PM", "19:30:00"],
    ["07:30 PM", "19:30:00"],
    ["19:30", "19:30:00"],
    ["19:30:00", "19:30:00"],
  ])("normalizes CRM human time %s to canonical %s", (input, expected) => {
    const raw = { startTime: input, otherField: "test" };
    const normalized = normalizeCrmBookingInput(raw) as { startTime: string };
    expect(normalized.startTime).toBe(expected);
  });

  it.each(["25:90", "99 PM", "garbage"])(
    "leaves invalid time %s unnormalized so schema rejects it",
    (input) => {
      const raw = { startTime: input, otherField: "test" };
      const normalized = normalizeCrmBookingInput(raw) as { startTime: string };
      expect(normalized.startTime).toBe(input);
    }
  );

  it("proves public booking schemas remain strict and reject 7 PM", () => {
    const publicSingle = createOnlineBookingSchema.safeParse({
      branchId: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
      serviceId: "2ea3ce31-6ead-49e0-9ff4-43501d5cf20e",
      date: "2026-10-01",
      startTime: "7 PM",
      fullName: "Jane Doe",
      phone: "09171234567",
    });
    expect(publicSingle.success).toBe(false);
    if (!publicSingle.success) {
      expect(publicSingle.error.issues[0]?.message).toBe("Time must be HH:MM");
    }

    const publicMulti = createOnlineBookingMultiSchema.safeParse({
      branchId: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
      serviceIds: ["2ea3ce31-6ead-49e0-9ff4-43501d5cf20e"],
      date: "2026-10-01",
      startTime: "7 PM",
      fullName: "Jane Doe",
      phone: "09171234567",
    });
    expect(publicMulti.success).toBe(false);
    if (!publicMulti.success) {
      expect(publicMulti.error.issues[0]?.message).toBe("Time must be HH:MM");
    }
  });

  it("proves public booking schemas accept canonical HH:MM", () => {
    const publicSingle = createOnlineBookingSchema.safeParse({
      branchId: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
      serviceId: "2ea3ce31-6ead-49e0-9ff4-43501d5cf20e",
      date: "2026-10-01",
      startTime: "19:00",
      fullName: "Jane Doe",
      phone: "09171234567",
    });
    expect(publicSingle.success).toBe(true);
  });

  it("proves executeInhouseBookingCreation normalizes 7 PM and passes schema validation", async () => {
    const { executeInhouseBookingCreation } = await import(
      "@/lib/bookings/inhouse-booking-engine"
    );

    const result = await executeInhouseBookingCreation(
      {
        branchId: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
        serviceIds: ["2ea3ce31-6ead-49e0-9ff4-43501d5cf20e"],
        date: "2026-10-01",
        startTime: "7 PM",
        fullName: "Jane Doe",
        phone: "09171234567",
      },
      {
        authUserId: "user-1",
        staff: null,
        staffRole: null,
        isDevBypass: false,
      }
    );

    // It passes validation and fails on UNAUTHORIZED operator check, NOT VALIDATION_ERROR
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("proves executeInhouseBookingCreation rejects garbage time at validation layer", async () => {
    const { executeInhouseBookingCreation } = await import(
      "@/lib/bookings/inhouse-booking-engine"
    );

    const result = await executeInhouseBookingCreation(
      {
        branchId: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
        serviceIds: ["2ea3ce31-6ead-49e0-9ff4-43501d5cf20e"],
        date: "2026-10-01",
        startTime: "garbage",
        fullName: "Jane Doe",
        phone: "09171234567",
      },
      {
        authUserId: "user-1",
        staff: null,
        staffRole: null,
        isDevBypass: false,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });
});
