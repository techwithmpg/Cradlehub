import { describe, expect, it } from "vitest";

import { evaluateDuplicateCheck } from "@/lib/staff/onboarding-validation";

const INPUT = {
  email: "applicant@example.com",
  phone: "+63 999 123 4567",
  fullName: "Maria Santos",
};

describe("evaluateDuplicateCheck", () => {
  it("flags an email already registered in auth.users", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: ["applicant@example.com"],
      requestEmails: [],
      activeStaffPhones: [],
      requestPhones: [],
    });

    expect(result.emailDuplicate).toBe(true);
    expect(result.phoneDuplicate).toBe(false);
    expect(result.namePhoneDuplicate).toBe(false);
  });

  it("flags an email already in a submitted onboarding request", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: [],
      requestEmails: ["applicant@example.com"],
      activeStaffPhones: [],
      requestPhones: [],
    });

    expect(result.emailDuplicate).toBe(true);
    expect(result.phoneDuplicate).toBe(false);
  });

  it("flags a phone already belonging to active staff", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: [],
      requestEmails: [],
      activeStaffPhones: [{ full_name: "Maria Santos", phone: "+63 999 123 4567" }],
      requestPhones: [],
    });

    expect(result.emailDuplicate).toBe(false);
    expect(result.phoneDuplicate).toBe(true);
    expect(result.namePhoneDuplicate).toBe(true);
  });

  it("flags a phone already in a submitted onboarding request", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: [],
      requestEmails: [],
      activeStaffPhones: [],
      requestPhones: [{ full_name: "Maria Santos", phone: "+63 999 123 4567" }],
    });

    expect(result.emailDuplicate).toBe(false);
    expect(result.phoneDuplicate).toBe(true);
    expect(result.namePhoneDuplicate).toBe(true);
  });

  it("flags a phone duplicate without matching full name", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: [],
      requestEmails: [],
      activeStaffPhones: [{ full_name: "Someone Else", phone: "+63 999 123 4567" }],
      requestPhones: [],
    });

    expect(result.phoneDuplicate).toBe(true);
    expect(result.namePhoneDuplicate).toBe(false);
  });

  it("returns no duplicates for a unique applicant", () => {
    const result = evaluateDuplicateCheck(INPUT, {
      authEmails: [],
      requestEmails: [],
      activeStaffPhones: [],
      requestPhones: [],
    });

    expect(result.emailDuplicate).toBe(false);
    expect(result.phoneDuplicate).toBe(false);
    expect(result.namePhoneDuplicate).toBe(false);
  });
});
