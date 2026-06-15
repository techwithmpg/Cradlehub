import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL_SETTINGS,
  calculatePayrollProgress,
  computeNextPayrollDate,
  computePayrollDateForMonth,
  getCountdownLabel,
  getPayrollReminderMessage,
  toIsoDate,
  type PayrollSettings,
} from "../../../src/lib/payroll/fixed-monthly";

function settings(overrides: Partial<PayrollSettings> = {}): PayrollSettings {
  return { ...DEFAULT_PAYROLL_SETTINGS, ...overrides };
}

describe("fixed monthly payroll helpers", () => {
  describe("computePayrollDateForMonth", () => {
    it("clamps the 31st to the last day of a short non-leap February", () => {
      const date = computePayrollDateForMonth(
        settings({ fixedDay: 31, weekendAdjustment: "none" }),
        2026,
        1
      );

      expect(toIsoDate(date)).toBe("2026-02-28");
    });

    it("clamps the 31st to February 29 in a leap year", () => {
      const date = computePayrollDateForMonth(
        settings({ fixedDay: 31, weekendAdjustment: "none" }),
        2028,
        1
      );

      expect(toIsoDate(date)).toBe("2028-02-29");
    });

    it("moves Saturday payday to the prior Friday", () => {
      const date = computePayrollDateForMonth(
        settings({ fixedDay: 30, weekendAdjustment: "prior_business_day" }),
        2025,
        7
      );

      expect(toIsoDate(date)).toBe("2025-08-29");
    });

    it("moves Sunday payday to the prior Friday", () => {
      const date = computePayrollDateForMonth(
        settings({
          paydayRule: "last_day_of_month",
          weekendAdjustment: "prior_business_day",
        }),
        2025,
        10
      );

      expect(toIsoDate(date)).toBe("2025-11-28");
    });
  });

  describe("computeNextPayrollDate", () => {
    it("uses this month's payroll date when it has not passed", () => {
      const date = computeNextPayrollDate(
        settings({ fixedDay: 30, weekendAdjustment: "none" }),
        new Date(2025, 5, 15)
      );

      expect(toIsoDate(date)).toBe("2025-06-30");
    });

    it("moves to next month when this month's payroll date has passed", () => {
      const date = computeNextPayrollDate(
        settings({ fixedDay: 15, weekendAdjustment: "none" }),
        new Date(2025, 5, 16)
      );

      expect(toIsoDate(date)).toBe("2025-07-15");
    });
  });

  describe("countdown and progress", () => {
    it("labels future, current, and overdue payroll dates", () => {
      const target = new Date(2025, 5, 30);

      expect(getCountdownLabel(target, new Date(2025, 5, 18))).toBe("In 12 days");
      expect(getCountdownLabel(target, new Date(2025, 5, 30))).toBe("Due today");
      expect(getCountdownLabel(target, new Date(2025, 6, 1))).toBe("Overdue by 1 day");
    });

    it("calculates whole-number payment progress", () => {
      expect(calculatePayrollProgress(18, 25)).toBe(72);
      expect(calculatePayrollProgress(0, 0)).toBe(0);
    });
  });

  describe("getPayrollReminderMessage", () => {
    it("shows reminders inside the configured reminder window", () => {
      const message = getPayrollReminderMessage({
        settings: settings({ reminderPreset: "2" }),
        nextPayrollDate: new Date(2025, 5, 30),
        unpaidStaff: 7,
        totalIncludedStaff: 25,
        today: new Date(2025, 5, 28),
      });

      expect(message).toBe("Reminder: Payroll is due on June 30, 2025. 7 staff are still unpaid.");
    });

    it("suppresses overdue reminders when that setting is disabled", () => {
      const message = getPayrollReminderMessage({
        settings: settings({ continueRemindersWhileUnpaid: false }),
        nextPayrollDate: new Date(2025, 5, 30),
        unpaidStaff: 7,
        totalIncludedStaff: 25,
        today: new Date(2025, 6, 1),
      });

      expect(message).toBeNull();
    });
  });
});
