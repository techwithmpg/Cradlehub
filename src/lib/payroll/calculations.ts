// Pure payroll calculation helpers — no DB calls, fully testable.

export type PayProfile = {
  base_pay_amount: number;
  base_pay_type: "none" | "daily" | "weekly" | "monthly";
  commission_percent: number;
  per_service_bonus: number;
  home_service_allowance: number;
  transport_allowance: number;
};

export type PayrollInputs = {
  profile: PayProfile;
  periodStartDate: string; // ISO date YYYY-MM-DD
  periodEndDate: string;   // ISO date YYYY-MM-DD
  completedBookingsCount: number;
  homeServiceBookingsCount: number;
  grossRevenue: number;
  // Aggregated from payroll_adjustments after generation
  bonusTotal: number;
  reimbursementTotal: number;
  deductionTotal: number;
  salaryAdvanceTotal: number;
};

export type PayrollBreakdown = {
  base_pay: number;
  commission_pay: number;
  bonus_pay: number;
  reimbursement_pay: number;
  home_service_allowance_pay: number;
  deduction_amount: number;
  salary_advance_amount: number;
  net_pay: number;
};

/** Returns number of calendar days in a date range, inclusive. */
export function periodDays(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

/** Calculates base pay for a period based on the profile's pay type. */
export function calculateBasePay(profile: PayProfile, periodStart: string, periodEnd: string): number {
  const { base_pay_amount, base_pay_type } = profile;
  if (base_pay_type === "none" || base_pay_amount <= 0) return 0;

  const days = periodDays(periodStart, periodEnd);

  switch (base_pay_type) {
    case "daily":
      return round2(base_pay_amount * days);
    case "weekly":
      return round2(base_pay_amount * (days / 7));
    case "monthly":
      return round2(base_pay_amount * (days / 30));
    default:
      return 0;
  }
}

/** Calculates commission from gross revenue. */
export function calculateCommission(grossRevenue: number, commissionPercent: number): number {
  if (commissionPercent <= 0 || grossRevenue <= 0) return 0;
  return round2(grossRevenue * (commissionPercent / 100));
}

/** Calculates home-service allowance (per-trip flat rate × number of HS bookings). */
export function calculateHomeServiceAllowance(
  homeServiceBookingsCount: number,
  allowancePerTrip: number
): number {
  if (allowancePerTrip <= 0 || homeServiceBookingsCount <= 0) return 0;
  return round2(allowancePerTrip * homeServiceBookingsCount);
}

/** Calculates the per-service bonus total. */
export function calculateServiceBonus(
  completedBookingsCount: number,
  perServiceBonus: number
): number {
  if (perServiceBonus <= 0 || completedBookingsCount <= 0) return 0;
  return round2(perServiceBonus * completedBookingsCount);
}

/** Full payroll breakdown for one staff member in one period. */
export function calculatePayrollItem(inputs: PayrollInputs): PayrollBreakdown {
  const {
    profile,
    periodStartDate,
    periodEndDate,
    completedBookingsCount,
    homeServiceBookingsCount,
    grossRevenue,
    bonusTotal,
    reimbursementTotal,
    deductionTotal,
    salaryAdvanceTotal,
  } = inputs;

  const base_pay = calculateBasePay(profile, periodStartDate, periodEndDate);
  const commission_pay = calculateCommission(grossRevenue, profile.commission_percent);
  const service_bonus = calculateServiceBonus(completedBookingsCount, profile.per_service_bonus);
  const home_service_allowance_pay = calculateHomeServiceAllowance(
    homeServiceBookingsCount,
    profile.home_service_allowance
  );

  const bonus_pay = round2(service_bonus + bonusTotal);
  const reimbursement_pay = round2(reimbursementTotal);
  const deduction_amount = round2(deductionTotal);
  const salary_advance_amount = round2(salaryAdvanceTotal);

  const net_pay = round2(
    base_pay +
    commission_pay +
    bonus_pay +
    reimbursement_pay +
    home_service_allowance_pay -
    deduction_amount -
    salary_advance_amount
  );

  return {
    base_pay,
    commission_pay,
    bonus_pay,
    reimbursement_pay,
    home_service_allowance_pay,
    deduction_amount,
    salary_advance_amount,
    net_pay,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
