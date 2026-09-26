import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";
import {
  buildDailyPaymentSummary,
  readBookingPayable,
  type PaymentSummaryRow,
} from "@/lib/bookings/payment-summary";
import { addDaysToYmd } from "@/lib/engine/slot-time";
import type { Database } from "@/types/supabase";

type Relation =
  | { name?: string; full_name?: string }
  | { name?: string; full_name?: string }[]
  | null;
export type CashFlowBookingRow = PaymentSummaryRow & {
  id: string;
  branch_id: string;
  booking_date: string;
  start_time: string;
  type: string;
  delivery_type: string | null;
  payment_reference: string | null;
  customers: Relation;
  services: Relation;
};
export type CashFlowReconciliation =
  Database["public"]["Tables"]["daily_cash_reconciliations"]["Row"];
export type CashFlowEntry = {
  id: string;
  date: string;
  time: string;
  customer: string;
  service: string;
  source: "booking" | "home_service";
  bookingType: string;
  bookingStatus: string;
  method: string;
  paymentStatus: string;
  reference: string | null;
  amount: number;
  payable: number;
  outstanding: number;
  servicePrice: number | null;
  travelFee: number | null;
};
export type CashFlowRange = { from: string; to: string };
export function validateCashFlowRange(range: CashFlowRange): CashFlowRange {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (
    !valid(range.from) ||
    !valid(range.to) ||
    range.from > range.to ||
    range.to > addDaysToYmd(range.from, 30)
  )
    throw new Error("Choose a valid date range of up to 31 days.");
  return { from: range.from, to: range.to };
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function optionalMoney(value: unknown): number | null {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}
function relation(value: Relation) {
  return Array.isArray(value) ? value[0] : value;
}
export function buildCashFlowDay(
  date: string,
  input: CashFlowBookingRow[],
  close: CashFlowReconciliation | null
) {
  // One canonical booking row is one financial snapshot, never one row per audit revision.
  const rows = [
    ...new Map(input.filter((r) => r.booking_date === date).map((r) => [r.id, r])).values(),
  ];
  const summary = buildDailyPaymentSummary(rows, date);
  const entries: CashFlowEntry[] = rows
    .filter((r) => !isBookingClosedForCrm(r.status))
    .map((r): CashFlowEntry => {
      const meta = object(r.metadata),
        breakdown = object(meta.pricing_breakdown);
      const payable = readBookingPayable(meta),
        amount = Number(r.amount_paid ?? 0);
      const source =
        r.delivery_type === "home_service" || r.type === "home_service"
          ? "home_service"
          : "booking";
      return {
        id: r.id,
        date,
        time: r.start_time,
        customer: relation(r.customers)?.full_name ?? "Walk-in / Guest",
        service: relation(r.services)?.name ?? "Service",
        source,
        bookingType: r.type,
        bookingStatus: r.status,
        method: r.payment_method ?? "other",
        paymentStatus: r.payment_status,
        reference: r.payment_reference,
        amount,
        payable,
        outstanding: ["unpaid", "pending"].includes(r.payment_status)
          ? Math.max(0, payable - amount)
          : 0,
        servicePrice: optionalMoney(breakdown.service_line_price),
        // A multi-service quote's full travel fee must not be attributed to every booking row.
        travelFee:
          source === "home_service" && breakdown.travel_fee_applied_to_booking === true
            ? optionalMoney(breakdown.home_service_travel_fee)
            : source === "home_service" && breakdown.travel_fee_applied_to_booking === false
              ? 0
              : null,
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time) || a.id.localeCompare(b.id));
  const expected = close
    ? close.expected_cash +
      close.expected_gcash +
      close.expected_maya +
      close.expected_card +
      close.expected_other
    : null;
  const actual = close
    ? close.actual_cash +
      close.actual_gcash +
      close.actual_maya +
      close.actual_card +
      close.actual_other
    : null;
  return {
    date,
    summary,
    entries,
    reconciliation: close,
    variance: actual !== null && expected !== null ? actual - expected : null,
  };
}
export type CashFlowDay = ReturnType<typeof buildCashFlowDay>;
export type CashFlowWorkspaceData = {
  branchId: string;
  branchName: string;
  today: CashFlowDay;
  range: CashFlowRange;
  days: CashFlowDay[];
  loadedAt: string;
};
export type CashFlowFilters = {
  search: string;
  date: string;
  source: string;
  method: string;
  status: string;
};
export const EMPTY_CASH_FLOW_FILTERS: CashFlowFilters = {
  search: "",
  date: "",
  source: "",
  method: "",
  status: "",
};
export function filterCashFlowEntries(entries: CashFlowEntry[], filters: CashFlowFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  return entries.filter(
    (row) =>
      (!filters.date || row.date === filters.date) &&
      (!filters.source || row.source === filters.source) &&
      (!filters.method || row.method === filters.method) &&
      (!filters.status || row.paymentStatus === filters.status) &&
      (!search ||
        [row.customer, row.service, row.reference, row.id].some((v) =>
          v?.toLocaleLowerCase().includes(search)
        ))
  );
}
export function reconciliationSummary(day: CashFlowDay) {
  const close = day.reconciliation;
  if (!close || close.status !== "approved") return day.summary;
  return {
    ...day.summary,
    total_collected:
      close.expected_cash +
      close.expected_gcash +
      close.expected_maya +
      close.expected_card +
      close.expected_other,
    by_method: {
      cash: close.expected_cash,
      gcash: close.expected_gcash,
      maya: close.expected_maya,
      card: close.expected_card,
      other: close.expected_other,
      pay_on_site: 0,
    },
  };
}
