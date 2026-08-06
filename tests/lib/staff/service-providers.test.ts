import { describe, expect, it } from "vitest";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";

describe("service provider role exclusions", () => {
  it("never treats digital marketers as bookable service providers", () => {
    expect(
      canActAsBookingServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "digital_marketer",
        },
        true
      )
    ).toBe(false);
  });
});
