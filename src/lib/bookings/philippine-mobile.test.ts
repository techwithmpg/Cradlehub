import { describe, expect, it } from "vitest";
import {
  FOREIGN_MOBILE_MESSAGE,
  INVALID_PH_MOBILE_MESSAGE,
  REQUIRED_PH_MOBILE_MESSAGE,
  getPhilippineMobileNumberError,
  getPublicPhoneFieldFeedback,
  isClearlyForeignMobilePrefix,
  isValidPhilippineMobileNumber,
  isValidPublicContactNumber,
  isValidInternationalContactNumber,
  needsInternationalEmailFallback,
  getPublicContactNumberError,
  INTERNATIONAL_MOBILE_FORMAT_MESSAGE,
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

  it("does not flag a partially typed +63 prefix as international", () => {
    expect(isClearlyForeignMobilePrefix("+")).toBe(false);
    expect(isClearlyForeignMobilePrefix("+6")).toBe(false);
    expect(isClearlyForeignMobilePrefix("+63")).toBe(false);
    expect(isClearlyForeignMobilePrefix("+1")).toBe(true);
    expect(isClearlyForeignMobilePrefix("+237")).toBe(true);
  });

  it("updates inline guidance immediately from the current input", () => {
    expect(getPublicPhoneFieldFeedback("").status).toBe("hint");
    expect(getPublicPhoneFieldFeedback("").message).toContain("09");
    expect(getPublicPhoneFieldFeedback("+6").status).toBe("error");
    expect(getPublicPhoneFieldFeedback("+6").message).toBe(INVALID_PH_MOBILE_MESSAGE);
    expect(getPublicPhoneFieldFeedback("+237612345678")).toEqual({
      status: "valid",
      message: "International number accepted for callback. Email is also required; SMS delivery is not guaranteed.",
    });
    expect(getPublicPhoneFieldFeedback("12345678").status).toBe("error");
    expect(getPublicPhoneFieldFeedback("0912345678").status).toBe("error");
    expect(getPublicPhoneFieldFeedback("09123456789").status).toBe("valid");
    expect(getPublicPhoneFieldFeedback("09123456789").message).toContain("accepted");
    expect(getPublicPhoneFieldFeedback("0912345678").status).toBe("error");
  });

  it.each(["+237612345678", "+447700900123", "+12125550123"])(
    "accepts E.164 international callback with email fallback: %s",
    (value) => {
      expect(isValidInternationalContactNumber(value)).toBe(true);
      expect(isValidPublicContactNumber(value)).toBe(true);
      expect(needsInternationalEmailFallback(value)).toBe(true);
      expect(getPublicContactNumberError(value)).toBeNull();
    }
  );

  it.each(["+237", "+0001234567", "+23712", "+1234567890123456", "00447700900123"])(
    "rejects malformed international contact: %s",
    (value) => {
      expect(isValidPublicContactNumber(value)).toBe(false);
    }
  );

  it("rejects malformed +63 numbers rather than treating them as international", () => {
    expect(isValidInternationalContactNumber("+6309123456789")).toBe(false);
    expect(getPublicContactNumberError("+6309123456789")).not.toBeNull();
    expect(getPublicContactNumberError("+237")).toBe(INTERNATIONAL_MOBILE_FORMAT_MESSAGE);
    expect(needsInternationalEmailFallback("09123456789")).toBe(false);
  });

  it("requires a nonempty number", () => {
    expect(getPhilippineMobileNumberError("  ")).toBe(REQUIRED_PH_MOBILE_MESSAGE);
  });
});
