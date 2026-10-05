import { describe, expect, it } from "vitest";
import { resolveBookingReferenceSource } from "./booking-source";

describe("CRM booking source", () => {
  it("defaults missing and legacy mixed-source URLs to CradleHub", () => {
    expect(resolveBookingReferenceSource(null)).toBe("cradlehub");
    expect(resolveBookingReferenceSource("all")).toBe("cradlehub");
    expect(resolveBookingReferenceSource("cradlehub")).toBe("cradlehub");
  });

  it("selects Master Sheet only when explicitly requested", () => {
    expect(resolveBookingReferenceSource("master_sheet")).toBe("master_sheet");
  });
});
