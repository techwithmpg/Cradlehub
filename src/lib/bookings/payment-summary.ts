import { isBookingClosedForCrm } from "./crm-booking-status";

export type PaymentSummaryRow = {
  status: string;
  metadata: unknown;
  payment_status: string;
  payment_method: string | null;
  amount_paid: number | null;
};

export function readBookingPayable(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const value = Number((metadata as Record<string, unknown>).price_paid ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** Canonical daily-summary semantics shared by CRM, Day Close and Cash Flow. */
export function buildDailyPaymentSummary(rows: PaymentSummaryRow[], date: string) {
  const active = rows.filter((row) => !isBookingClosedForCrm(row.status));
  const unpaid = active.filter((row) => ["unpaid", "pending"].includes(row.payment_status));
  const byMethod: Record<string, number> = {
    cash: 0,
    gcash: 0,
    maya: 0,
    card: 0,
    pay_on_site: 0,
    other: 0,
  };
  for (const row of active.filter((row) => Number(row.amount_paid ?? 0) > 0)) {
    const method = row.payment_method ?? "other";
    byMethod[method] = (byMethod[method] ?? 0) + Number(row.amount_paid ?? 0);
  }
  return {
    date,
    total_expected: active.reduce((sum, row) => sum + readBookingPayable(row.metadata), 0),
    total_collected: active.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0),
    total_unpaid: unpaid.reduce(
      (sum, row) =>
        sum + Math.max(0, readBookingPayable(row.metadata) - Number(row.amount_paid ?? 0)),
      0
    ),
    paid_count: active.filter((row) => row.payment_status === "paid").length,
    unpaid_count: unpaid.length,
    total_count: active.length,
    by_method: byMethod as {
      cash: number;
      gcash: number;
      maya: number;
      card: number;
      pay_on_site: number;
      other: number;
    },
  };
}
export type DailyPaymentSummary = ReturnType<typeof buildDailyPaymentSummary>;
