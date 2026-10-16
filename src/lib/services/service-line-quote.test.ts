import { describe, expect, it } from "vitest";
import { calculateServiceLineQuote, serviceLineQuoteOptions, toServiceLineCommercialSnapshot } from "./service-line-quote";

const fixed = {
  id: "fixed", duration_policy: "fixed", duration_minutes: 60, price: 800,
  extension_increment_minutes: null, extension_price: null, maximum_duration_minutes: null,
};
const extendable = {
  id: "extendable", duration_policy: "extendable", duration_minutes: 60, price: 800,
  extension_increment_minutes: 30, extension_price: 350, maximum_duration_minutes: 180,
};
const noOverride = { custom_price: null, custom_duration_minutes: null };

describe("service line quote", () => {
  it("preserves a fixed service and its branch override", () => {
    expect(calculateServiceLineQuote({ service: fixed, branch: noOverride }).calculatedPrice).toBe(800);
    expect(calculateServiceLineQuote({ service: fixed, branch: { custom_price: 900, custom_duration_minutes: 75 } })).toMatchObject({
      selectedDurationMinutes: 75, calculatedPrice: 900, extensionUnits: 0,
    });
  });
  it("rejects changing a fixed duration", () => {
    expect(() => calculateServiceLineQuote({ service: fixed, branch: noOverride, requestedDurationMinutes: 90 })).toThrow("INVALID_SERVICE_DURATION");
  });
  it("defaults an extendable service to base and produces exact stops", () => {
    expect(calculateServiceLineQuote({ service: extendable, branch: noOverride })).toMatchObject({
      selectedDurationMinutes: 60, calculatedPrice: 800, extensionUnits: 0,
    });
    expect(serviceLineQuoteOptions({ service: extendable, branch: noOverride }).map((option) => [option.selectedDurationMinutes, option.calculatedPrice])).toEqual([
      [60, 800], [90, 1150], [120, 1500], [150, 1850], [180, 2200],
    ]);
  });
  it.each([30, 61, 75, 181, 300, 90.5])("rejects invalid requested duration %s", (duration) => {
    expect(() => calculateServiceLineQuote({ service: extendable, branch: noOverride, requestedDurationMinutes: duration })).toThrow("INVALID_SERVICE_DURATION");
  });
  it.each([
    { extension_increment_minutes: 0 },
    { extension_increment_minutes: -30 },
    { extension_price: null },
    { extension_price: -1 },
    { maximum_duration_minutes: 60 },
    { maximum_duration_minutes: 175 },
  ])("fails closed for invalid catalog config %j", (override) => {
    expect(() => calculateServiceLineQuote({ service: { ...extendable, ...override }, branch: noOverride })).toThrow("SERVICE_DURATION_CONFIGURATION_INVALID");
  });
  it("does not combine an extendable service with branch pricing or duration", () => {
    expect(() => calculateServiceLineQuote({ service: extendable, branch: { custom_price: 1000, custom_duration_minutes: null } })).toThrow("SERVICE_DURATION_OVERRIDE_UNSUPPORTED");
    expect(() => calculateServiceLineQuote({ service: extendable, branch: { custom_price: null, custom_duration_minutes: 90 } })).toThrow("SERVICE_DURATION_OVERRIDE_UNSUPPORTED");
  });
  it("uses integer cents for repeated decimal extensions", () => {
    const quote = calculateServiceLineQuote({ service: { ...extendable, price: 0.1, extension_price: 0.2 }, branch: noOverride, requestedDurationMinutes: 120 });
    expect(quote.calculatedPrice).toBe(0.5);
    expect(toServiceLineCommercialSnapshot(quote)).toMatchObject({ selected_duration_minutes: 120, extension_units: 2, calculated_price: 0.5 });
  });
  it("quotes different service lines independently", () => {
    const a = calculateServiceLineQuote({ service: extendable, branch: noOverride, requestedDurationMinutes: 120 });
    const b = calculateServiceLineQuote({ service: extendable, branch: noOverride, requestedDurationMinutes: 90 });
    expect([a.calculatedPrice, b.calculatedPrice]).toEqual([1500, 1150]);
  });
});
