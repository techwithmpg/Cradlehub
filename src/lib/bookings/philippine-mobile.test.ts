import { describe, expect, it } from "vitest";
import {
  FOREIGN_MOBILE_MESSAGE,
  INVALID_PH_MOBILE_MESSAGE,
  REQUIRED_PH_MOBILE_MESSAGE,
  getPhilippineMobileNumberError,
  isValidPhilippineMobileNumber,
} from "./philippine-mobile";

describe("public booking Philippine mobile contact", () => {
  it.each([
    "09123456789",
    "+639123456789",
    "639123456789",
    "0912 345 6789",
    "+63 912 345 6789",
    "0912-345-6789",
  ])("accepts a Philippine mobile format: %s", (value) => {
    expect(isValidPhilippineMobileNumber(value)).toBe(true);
    expect(getPhilippineMobileNumberError(value)).toBeNull();
  });

  it.each(["+12345678901", "+237612345678", "+447700900123", "0044912345678"])(
    "flags an international number: %s",
    (value) => {
      expect(isValidPhilippineMobileNumber(value)).toBe(false);
      expect(getPhilippineMobileNumberError(value)).toBe(FOREIGN_MOBILE_MESSAGE);
    }
  );

  it.each([
    "08123456789",
    "0912345678",
    "091234567890",
    "+63912345678",
    "+6309123456789",
    "0912345abcd",
    "0912+3456789",
  ])("rejects an invalid local format: %s", (value) => {
    expect(isValidPhilippineMobileNumber(value)).toBe(false);
    expect(getPhilippineMobileNumberError(value)).toBe(INVALID_PH_MOBILE_MESSAGE);
  });

  it("requires a nonempty number", () => {
    expect(getPhilippineMobileNumberError("  ")).toBe(REQUIRED_PH_MOBILE_MESSAGE);
  });
});
