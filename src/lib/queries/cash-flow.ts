import { createClient } from "@/lib/supabase/server";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";

type Relation<T> = T | T[] | null | undefined;

type RawCashFlowBookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  type: string | null;
  delivery_type: string | null;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  amount_paid: number | string | null;
  services: Relation<{ name: string | null }>;
  customers: Relation<{ full_name: string | null }>;
};

export type CashFlowTransaction = {
  id: string;
  bookingDate: string;
  startTime: string;
  customerName: string;
  serviceName: string;
  bookingSource: string;
  deliveryType: string | null;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference: string | null;
  amount: number;
};

export type CashFlowDayClose = {
  id: string;
  date: string;
  status: string;
  expected: number;
  actual: number;
  variance: number;
} | null;

function firstRelation<T>(value: Relation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function money(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const normalized = String(method ?? "other")
    .trim()
    .toLowerCase();

  if (normalized === "gcash") return "GCash";
  if (normalized === "maya") return "Maya";
  if (normalized === "card") return "Card";
  if (normalized === "cash") return "Cash";
  if (normalized === "pay_on_site") return "Pay on Site";

  return normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildCashFlowTransactions(rows: RawCashFlowBookingRow[]): CashFlowTransaction[] {
  return rows
    .filter((row) => !isBookingClosedForCrm(row.status))
    .filter((row) => money(row.amount_paid) > 0)
    .map((row) => {
      const customer = firstRelation(row.customers);
      const service = firstRelation(row.services);

      return {
        id: row.id,
        bookingDate: row.booking_date,
        startTime: row.start_time,
        customerName: customer?.full_name?.trim() || "Walk-in / Guest",
        serviceName: service?.name?.trim() || "Service",
        bookingSource:
          row.delivery_type === "home_service"
            ? "Home Service"
            : row.type === "walkin"
              ? "Walk-in"
              : row.type === "online"
                ? "Online"
                : row.type || "Booking",
        deliveryType: row.delivery_type,
        paymentMethod: row.payment_method || "other",
        paymentStatus: row.payment_status || "unknown",
        paymentReference: row.payment_reference,
        amount: money(row.amount_paid),
      };
    })
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
}

export async function getCashFlowTransactions(
  branchId: string,
  date: string
): Promise<CashFlowTransaction[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_date,
      start_time,
      type,
      delivery_type,
      status,
      payment_method,
      payment_status,
      payment_reference,
      amount_paid,
      services ( name ),
      customers ( full_name )
    `
    )
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return buildCashFlowTransactions((data ?? []) as unknown as RawCashFlowBookingRow[]);
}

export async function getCashFlowDayClose(
  branchId: string,
  date: string
): Promise<CashFlowDayClose> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("daily_cash_reconciliations")
    .select(
      `
      id,
      reconciliation_date,
      status,
      expected_cash,
      expected_gcash,
      expected_maya,
      expected_card,
      expected_other,
      actual_cash,
      actual_gcash,
      actual_maya,
      actual_card,
      actual_other
    `
    )
    .eq("branch_id", branchId)
    .eq("reconciliation_date", date)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  const expected =
    money(data.expected_cash) +
    money(data.expected_gcash) +
    money(data.expected_maya) +
    money(data.expected_card) +
    money(data.expected_other);

  const actual =
    money(data.actual_cash) +
    money(data.actual_gcash) +
    money(data.actual_maya) +
    money(data.actual_card) +
    money(data.actual_other);

  return {
    id: data.id,
    date: data.reconciliation_date,
    status: data.status,
    expected,
    actual,
    variance: actual - expected,
  };
}
