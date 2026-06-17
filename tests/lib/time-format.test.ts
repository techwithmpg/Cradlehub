import { describe, expect, it } from "vitest";
import {
  formatShiftTimeRange,
  getShiftDurationMinutes,
  isValidShiftRange,
} from "../../src/lib/utils/time-format";

describe("time range helpers", () => {
  it("accepts overnight shifts up to 16 hours", () => {
    expect(getShiftDurationMinutes("17:00", "01:00")).toBe(480);
    expect(isValidShiftRange("17:00", "01:00")).toBe(true);
  });

  it("rejects zero-length and overly long shifts", () => {
    expect(isValidShiftRange("09:00", "09:00")).toBe(false);
    expect(isValidShiftRange("08:00", "01:00")).toBe(false);
  });

  it("marks overnight labels as next-day ranges", () => {
    expect(formatShiftTimeRange("17:00", "01:00")).toBe(
      "5:00 PM – 1:00 AM (+1)"
    );
  });
});
