export type PaydayRule = "fixed_day" | "last_day_of_month";
export type WeekendAdjustment = "none" | "prior_business_day";
export type ReminderPreset = "none" | "1" | "2" | "3" | "5" | "7" | "custom";
export type PayrollPaymentMethod = "cash" | "gcash" | "bank_transfer" | "other";

export type PayrollSettings = {
  paydayRule: PaydayRule;
  fixedDay: number;
  weekendAdjustment: WeekendAdjustment;
  reminderPreset: ReminderPreset;
  customReminderDays: number;
  includeInactiveEmployees: boolean;
  defaultPaymentStatus: "unpaid";
  allowStatusEditing: boolean;
  showTotalPayroll: boolean;
  trackingStartMonth: number;
  trackingStartYear: number;
  continueRemindersWhileUnpaid: boolean;
  enabledPaymentMethods: PayrollPaymentMethod[];
  showOwnerDashboardReminder: boolean;
  showPayrollPageReminder: boolean;
  notifyPayrollDue: boolean;
  notifyPayrollFullyPaid: boolean;
};

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  paydayRule: "fixed_day",
  fixedDay: 30,
  weekendAdjustment: "prior_business_day",
  reminderPreset: "2",
  customReminderDays: 2,
  includeInactiveEmployees: false,
  defaultPaymentStatus: "unpaid",
  allowStatusEditing: true,
  showTotalPayroll: true,
  trackingStartMonth: 1,
  trackingStartYear: 2026,
  continueRemindersWhileUnpaid: true,
  enabledPaymentMethods: ["cash", "gcash", "bank_transfer", "other"],
  showOwnerDashboardReminder: true,
  showPayrollPageReminder: true,
  notifyPayrollDue: true,
  notifyPayrollFullyPaid: true,
};

const DAY_MS = 86_400_000;

export function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(value: string): Date {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}

export function getMonthBounds(anchorDate: Date): { start: string; end: string } {
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getDaysUntil(target: Date, today = new Date()): number {
  const start = dateOnly(today).getTime();
  const end = dateOnly(target).getTime();
  return Math.round((end - start) / DAY_MS);
}

export function getOrdinalDay(day: number): string {
  const suffix =
    day % 10 === 1 && day % 100 !== 11
      ? "st"
      : day % 10 === 2 && day % 100 !== 12
        ? "nd"
        : day % 10 === 3 && day % 100 !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

export function formatPeso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export function formatPayrollDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPayrollPreviewDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getCountdownLabel(target: Date, today = new Date()): string {
  const days = getDaysUntil(target, today);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `In ${days} days`;
  return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
}

export function getReminderDays(settings: PayrollSettings): number | null {
  if (settings.reminderPreset === "none") return null;
  if (settings.reminderPreset === "custom") return settings.customReminderDays;
  return Number(settings.reminderPreset);
}

export function computePayrollDateForMonth(
  settings: Pick<PayrollSettings, "paydayRule" | "fixedDay" | "weekendAdjustment">,
  year: number,
  monthIndex: number
): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = settings.paydayRule === "last_day_of_month"
    ? lastDay
    : Math.min(Math.max(settings.fixedDay, 1), lastDay);
  const date = new Date(year, monthIndex, day);

  if (settings.weekendAdjustment !== "prior_business_day") return date;

  if (date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  } else if (date.getDay() === 0) {
    date.setDate(date.getDate() - 2);
  }

  return date;
}

export function computeNextPayrollDate(settings: PayrollSettings, today = new Date()): Date {
  const base = dateOnly(today);
  const thisMonth = computePayrollDateForMonth(settings, base.getFullYear(), base.getMonth());
  if (thisMonth.getTime() >= base.getTime()) return thisMonth;
  return computePayrollDateForMonth(settings, base.getFullYear(), base.getMonth() + 1);
}

export function calculatePayrollProgress(paidStaff: number, totalIncludedStaff: number): number {
  if (totalIncludedStaff <= 0) return 0;
  return Math.round((paidStaff / totalIncludedStaff) * 100);
}

export function getPayrollReminderMessage(input: {
  settings: PayrollSettings;
  nextPayrollDate: Date;
  unpaidStaff: number;
  totalIncludedStaff: number;
  today?: Date;
}): string | null {
  const { settings, nextPayrollDate, unpaidStaff, totalIncludedStaff, today = new Date() } = input;
  if (!settings.showPayrollPageReminder || totalIncludedStaff === 0) return null;

  const days = getDaysUntil(nextPayrollDate, today);
  const reminderDays = getReminderDays(settings);
  const shouldShow = days <= 0 || (reminderDays !== null && days <= reminderDays);
  if (!shouldShow) return null;
  if (days < 0 && !settings.continueRemindersWhileUnpaid) return null;

  const month = nextPayrollDate.toLocaleDateString("en-PH", { month: "long" });
  const date = formatPayrollDate(nextPayrollDate);

  if (unpaidStaff === 0) {
    return `All staff have been paid for ${month}.`;
  }

  if (days === 0) {
    return `Payroll is due today. ${unpaidStaff} staff still need payment.`;
  }

  if (days < 0) {
    return `Payroll was due on ${date}. ${unpaidStaff} staff are still unpaid.`;
  }

  return `Reminder: Payroll is due on ${date}. ${unpaidStaff} staff are still unpaid.`;
}

export function normalizePaymentMethods(methods: readonly string[] | null | undefined): PayrollPaymentMethod[] {
  const allowed: PayrollPaymentMethod[] = ["cash", "gcash", "bank_transfer", "other"];
  const selected = allowed.filter((method) => methods?.includes(method));
  return selected.length > 0 ? selected : DEFAULT_PAYROLL_SETTINGS.enabledPaymentMethods;
}
