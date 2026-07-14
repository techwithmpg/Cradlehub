import {
  deriveAttendanceClosingTimeline,
  type AttendanceStaffCategory,
} from "@/lib/attendance/closing-policy";
import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";

export type BranchAttendanceRuleValidationInput = {
  timezone: string;
  attendanceDayBoundary: string;
  lateGraceMinutes: number;
  earlyLeaveThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  duplicateScanWindowSeconds: number;
  branchOperatingCloseTime: string;
  crmClosingBufferMinutes: number;
  crmManagerEscalationDelayMinutes: number;
  crmHardCutoffDelayMinutes: number;
  effectiveDate: string | null;
  reason: string;
};

export type CategoryAttendanceRuleValidationInput = {
  category: AttendanceStaffCategory;
  lateGraceMinutes: number | null;
  earlyLeaveThresholdMinutes: number | null;
  overtimeThresholdMinutes: number | null;
  effectiveDate: string | null;
  reason: string;
};

function validTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59 && Number(match[3] ?? 0) <= 59;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validEffectiveDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateBranchAttendanceRulesInput(
  input: BranchAttendanceRuleValidationInput
): string | null {
  if (!validTimezone(input.timezone) || !validTime(input.attendanceDayBoundary)) {
    return "Timezone or Attendance day boundary is invalid.";
  }
  if (!validTime(input.branchOperatingCloseTime)) {
    return "Branch closing time is invalid.";
  }
  if (
    !inRange(input.lateGraceMinutes, 0, 240) ||
    !inRange(input.earlyLeaveThresholdMinutes, 0, 240) ||
    !inRange(input.overtimeThresholdMinutes, 0, 240) ||
    !inRange(input.duplicateScanWindowSeconds, 10, 600) ||
    !inRange(input.crmClosingBufferMinutes, 0, 240) ||
    !inRange(input.crmManagerEscalationDelayMinutes, 1, 240) ||
    !inRange(input.crmHardCutoffDelayMinutes, 1, 360) ||
    input.crmHardCutoffDelayMinutes <= input.crmManagerEscalationDelayMinutes
  ) {
    return "One or more minute values are outside the allowed range.";
  }
  if (!validEffectiveDate(input.effectiveDate) || input.reason.trim().length < 5) {
    return "Provide a valid effective date and a short change reason.";
  }

  try {
    const businessDate = "2026-01-15";
    const timeline = deriveAttendanceClosingTimeline({
      businessDate,
      timezone: input.timezone,
      branchCloseTime: input.branchOperatingCloseTime,
      normalBufferMinutes: input.crmClosingBufferMinutes,
      managerEscalationDelayMinutes: input.crmManagerEscalationDelayMinutes,
      hardCutoffDelayMinutes: input.crmHardCutoffDelayMinutes,
    });
    const nextBoundary = branchDateTimeToIsoInTimezone({
      date: "2026-01-16",
      time: input.attendanceDayBoundary,
      timezone: input.timezone,
    });
    if (new Date(timeline.hardCutoffAt).getTime() >= new Date(nextBoundary).getTime()) {
      return "The CRM hard cutoff must remain before the next Attendance day boundary.";
    }
  } catch {
    return "The CRM closing timeline could not be calculated.";
  }
  return null;
}

export function validateCategoryAttendanceRuleInput(
  input: CategoryAttendanceRuleValidationInput
): string | null {
  for (const value of [
    input.lateGraceMinutes,
    input.earlyLeaveThresholdMinutes,
    input.overtimeThresholdMinutes,
  ]) {
    if (value !== null && !inRange(value, 0, 240)) {
      return "Category minute values must be blank or between 0 and 240.";
    }
  }
  if (!validEffectiveDate(input.effectiveDate) || input.reason.trim().length < 5) {
    return "Provide a valid effective date and a short change reason.";
  }
  return null;
}
