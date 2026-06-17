import { describe, expect, it } from "vitest";
import {
  getPasswordValidationError,
  isPasswordValid,
  PASSWORD_REQUIREMENT_MESSAGE,
} from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("accepts a password with the required length and character classes", () => {
    expect(isPasswordValid("Strong123")).toBe(true);
    expect(getPasswordValidationError("Strong123")).toBeNull();
  });

  it("rejects weak passwords", () => {
    expect(getPasswordValidationError("short1A")).toBe(PASSWORD_REQUIREMENT_MESSAGE);
    expect(getPasswordValidationError("lowercase1")).toBe(PASSWORD_REQUIREMENT_MESSAGE);
    expect(getPasswordValidationError("UPPERCASE1")).toBe(PASSWORD_REQUIREMENT_MESSAGE);
    expect(getPasswordValidationError("NoNumberHere")).toBe(PASSWORD_REQUIREMENT_MESSAGE);
  });
});
