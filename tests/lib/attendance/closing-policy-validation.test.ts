import { describe, expect, it } from "vitest";

import {
  validateBranchAttendanceRulesInput,
  validateCategoryAttendanceRuleInput,
  type BranchAttendanceRuleValidationInput,
} from "@/lib/attendance/closing-policy-validation";

const validBranchInput: BranchAttendanceRuleValidationInput = {
  timezone: "Asia/Manila",
  attendanceDayBoundary: "06:00",
  lateGraceMinutes: 10,
  earlyLeaveThresholdMinutes: 5,
  overtimeThresholdMinutes: 15,
  duplicateScanWindowSeconds: 90,
  branchOperatingCloseTime: "22:30",
  crmClosingBufferMinutes: 30,
  crmManagerEscalationDelayMinutes: 30,
  crmHardCutoffDelayMinutes: 60,
  effectiveDate: null,
  reason: "Closing policy update",
};

describe("branch Attendance rule validation", () => {
  it("accepts the default overnight-safe CRM closing timeline", () => {
    expect(validateBranchAttendanceRulesInput(validBranchInput)).toBeNull();
  });

  it("rejects invalid branch-local time and timezone values", () => {
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        timezone: "Not/A_Timezone",
      })
    ).toMatch(/timezone/i);
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        branchOperatingCloseTime: "25:00",
      })
    ).toMatch(/closing time/i);
  });

  it("requires escalation after reminder and hard cutoff after escalation", () => {
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        crmManagerEscalationDelayMinutes: 0,
      })
    ).toMatch(/allowed range/i);
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        crmHardCutoffDelayMinutes: 30,
      })
    ).toMatch(/allowed range/i);
  });

  it("rejects a hard cutoff that reaches the next Attendance boundary", () => {
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        attendanceDayBoundary: "00:00",
      })
    ).toMatch(/before the next Attendance day boundary/i);
  });

  it("rejects invalid future dates and short audit reasons", () => {
    expect(
      validateBranchAttendanceRulesInput({
        ...validBranchInput,
        effectiveDate: "2026-02-30",
      })
    ).toMatch(/effective date/i);
    expect(
      validateBranchAttendanceRulesInput({ ...validBranchInput, reason: "no" })
    ).toMatch(/change reason/i);
  });
});

describe("category Attendance rule validation", () => {
  it("allows inherited null values and rejects out-of-range overrides", () => {
    expect(
      validateCategoryAttendanceRuleInput({
        category: "utility",
        lateGraceMinutes: null,
        earlyLeaveThresholdMinutes: null,
        overtimeThresholdMinutes: null,
        effectiveDate: null,
        reason: "Use branch defaults",
      })
    ).toBeNull();
    expect(
      validateCategoryAttendanceRuleInput({
        category: "utility",
        lateGraceMinutes: 241,
        earlyLeaveThresholdMinutes: null,
        overtimeThresholdMinutes: null,
        effectiveDate: null,
        reason: "Invalid override",
      })
    ).toMatch(/between 0 and 240/i);
  });
});
