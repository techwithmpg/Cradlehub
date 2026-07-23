import { describe, expect, it } from "vitest";
import { getBranchWalkInDefaults, parseBookingTime } from "./booking-clock-time";

describe("parseBookingTime", () => {
  it.each([
    ["16:15", "16:15:00"],
    ["16:15:00", "16:15:00"],
    ["4:15 PM", "16:15:00"],
    ["04:15 pm", "16:15:00"],
    ["12:00 AM", "00:00:00"],
    ["12:00 PM", "12:00:00"],
  ])("parses %s", (input, canonicalTime) => {
    const result = parseBookingTime(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canonicalTime).toBe(canonicalTime);
  });

  it.each(["", "25:00", "12:60", "4 PM", "noon"])("rejects %s", (input) => {
    expect(parseBookingTime(input).ok).toBe(false);
  });
});

describe("getBranchWalkInDefaults", () => {
  it("uses Asia/Manila time and rounds up to the next quarter", () => {
    const result = getBranchWalkInDefaults(new Date("2026-07-22T08:07:00.000Z"));
    expect(result).toEqual({ date: "2026-07-22", time: "16:15:00" });
  });
});
