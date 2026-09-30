import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isCashFlowReceiptTransactionType } from "@/lib/cash-flow/payment-evidence";

function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

const bkg3 = migration("20260927080000_bkg3_booking_order_atomic.sql");
const cf2 = migration("20260927120000_cf2_financial_foundation.sql");
const cf3 = migration("20260927130000_cf3_order_payables_allocations.sql");
const cf4 = migration("20260927140000_cf4_atomic_payment_writer.sql");
const cf6 = migration("20260928120000_cf6_operational_cash_flow_writers.sql");
const cf7 = migration("20260929120000_cf7_expense_receipt_storage.sql");
const cash = migration("20260929130000_cf8_cash_sessions_foundation.sql");
const cf8 = migration("20260929140000_cf8_booking_payment_command.sql");
const cashQuery = readFileSync(
  resolve(process.cwd(), "src/lib/cash-flow/cash-flow-queries.ts"),
  "utf8"
);

describe("CF8 database reconciliation against accepted repository contracts", () => {
  it("DB01/DB03: booking and order financial reads have declared source columns", () => {
    expect(bkg3).toContain("organizer_customer_id");
    expect(bkg3).toContain("attendee_id");
    expect(bkg3).toContain("line_sequence");
    for (const column of ["total_payable", "net_allocated", "remaining_balance", "payment_state"]) {
      expect(cf3).toContain(column);
    }
    expect(cashQuery).toContain(".from('order_payable_items')");
  });

  it("DB02: pending money writers use the live system_role authority", () => {
    for (const sql of [cf4, cf6, cf7, cash, cf8]) {
      expect(sql).not.toMatch(/(?:s|v_staff)\.role\b|\bAND role IN\s*\(/);
      expect(sql).toContain("system_role");
    }
  });

  it("DB04/DB05/DB06: only one service booking without order charges can mirror money", () => {
    expect(cf8).toContain("count(*) FROM public.bookings other");
    expect(cf8).toContain("opi.charge_type <> 'service'");
    expect(cf8).toContain("ORDER_LEVEL_PAYMENT_REQUIRED");
    expect(cf3).toContain("payable_item_id");
  });

  it("DB07/DB08/DB10: receipt classification excludes transfer, adjustment, tip and snapshots", () => {
    expect(isCashFlowReceiptTransactionType("customer_payment")).toBe(true);
    for (const type of [
      "cash_adjustment",
      "tip_collection",
      "tip_disbursement",
      "operational_expense",
    ]) {
      expect(isCashFlowReceiptTransactionType(type)).toBe(false);
    }
    expect(cashQuery).toContain("isCashFlowReceiptTransactionType(tx.transaction_type)");
    expect(cashQuery).toContain("findUnmatchedBookingPayments");
    expect(cashQuery).not.toMatch(/totalInflowFromMovements\s*\+=\s*(?:Number\()?b\.amount_paid/);
  });

  it("DB09: opening float is cash session state and movement timing uses movement creation", () => {
    const openFunction = cash.slice(
      cash.indexOf("CREATE OR REPLACE FUNCTION public.open_cash_session_atomic(")
    );
    expect(openFunction).toContain("opening_float");
    expect(openFunction).not.toContain("INSERT INTO public.financial_transactions");
    expect(openFunction).not.toContain("INSERT INTO public.financial_account_movements");
    expect(cashQuery).toContain("mCreatedAtMs >= sessionOpenedAtMs");
    expect(cashQuery).not.toContain("mCreatedAtMs >= sessionOpenedAtMs ||");
  });

  it("DB11/DB12: direct tip has no company movement; custodial tip is pending liability", () => {
    expect(cf6).toContain("IF p_custody_type = 'company_custodied' THEN");
    expect(cf6).toContain("'pending_disbursement'");
    expect(cf6).toContain("Direct Cash Tip: zero company custody, zero account movement");
    expect(cf6).toContain("'not_applicable'");
    expect(isCashFlowReceiptTransactionType("tip_collection")).toBe(false);
  });

  it("DB13: customer Home Service fee and actual expense have distinct sources", () => {
    expect(cf8).toContain("'home_service_fee'");
    expect(cf6).toContain("'operational_expense'");
    expect(cf6).not.toContain("'payroll_run', -- generic internal source");
  });

  it("DB18/DB19/DB20: collected creation composes order and payment only when paid", () => {
    const wrapper = cf8.slice(
      cf8.indexOf("CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic(")
    );
    expect(wrapper).toContain("public.create_booking_order_atomic(");
    expect(wrapper).toContain("public.post_order_payment_atomic(");
    expect(wrapper).toContain("IF NOT v_paid THEN");
    expect(bkg3).toContain("'pay_on_site'");
    expect(cf8).not.toMatch(
      /CREATE\s+TRIGGER[^;]+(?:session_completed|payment_status)[^;]+financial_transactions/i
    );
  });

  it("DB21/DB22/DB23/DB24: incremental and split tender posting validates replay and account ambiguity", () => {
    expect(cf8).toContain("v_delta := p_amount_paid - COALESCE(v_booking.amount_paid, 0)");
    expect(cf8).toContain("v_total <> v_delta");
    expect(cf8).toContain("v_existing_parts <> v_requested_parts");
    expect(cf8).toContain("ACCOUNT_SELECTION_REQUIRED");
  });

  it("DB25/DB26/DB27: legacy payments remain explicit and every money writer rejects absent actor or wrong branch", () => {
    expect(cf8).toContain("'legacy_booking'");
    expect(cf8).toContain("STAFF_INACTIVE");
    expect(cf8).toContain("BRANCH_UNAUTHORIZED");
    for (const sql of [cf6, cf7]) {
      expect(sql).not.toContain("ORDER BY created_at LIMIT 1");
      expect(sql).toContain("AUTH_REQUIRED");
      expect(sql).toContain("BRANCH_MISMATCH");
    }
  });

  it("DB28: privileged new functions pin search_path and remove public execution", () => {
    for (const sql of [cf6, cf7, cash, cf8]) {
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("FROM PUBLIC, anon");
    }
    expect(cf8).toContain("TO service_role;");
  });

  it("DB29/DB30: pending migrations have no generic booking payment trigger or historical receipt backfill", () => {
    for (const sql of [cf2, cf3, cf4, cf6, cf7, cash, cf8]) {
      expect(sql).not.toMatch(/CREATE\s+TRIGGER\s+[^;]*payment[^;]*ON\s+public\.bookings/i);
      expect(sql).not.toMatch(
        /INSERT\s+INTO\s+public\.financial_transactions\s*\([^;]+\)\s*SELECT[^;]+FROM\s+public\.bookings/i
      );
    }
  });

  it("rejects non-PHP order currency before any order-backed payment or replay", () => {
    const guard = "UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only";
    const cf4Writer = cf4.slice(cf4.indexOf("CREATE OR REPLACE FUNCTION public.post_order_payment_atomic("));
    const cf8Writer = cf8.slice(
      cf8.indexOf("CREATE OR REPLACE FUNCTION public.post_order_payment_atomic("),
      cf8.indexOf("CREATE OR REPLACE FUNCTION public.post_booking_payment_atomic(")
    );
    const bookingCommand = cf8.slice(
      cf8.indexOf("CREATE OR REPLACE FUNCTION public.post_booking_payment_atomic("),
      cf8.indexOf("CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic(")
    );
    const creation = cf8.slice(cf8.indexOf("CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic("));
    for (const writer of [cf4Writer, cf8Writer]) {
      expect(writer).toMatch(/SELECT id, branch_id, organizer_customer_id, booking_date, (?:metadata, )?currency/);
      expect(writer).toContain("v_order.currency IS DISTINCT FROM 'PHP'");
      expect(writer).toContain(guard);
      expect(writer.indexOf(guard)).toBeGreaterThan(writer.indexOf("BRANCH_UNAUTHORIZED: Staff"));
    }
    expect(bookingCommand).toContain("bo.currency");
    expect(bookingCommand.indexOf(guard)).toBeLessThan(bookingCommand.indexOf("IF p_idempotency_key IS NOT NULL THEN"));
    expect(creation).toContain("IF v_paid AND v_order_currency IS DISTINCT FROM 'PHP' THEN");
    expect(creation.indexOf(guard)).toBeLessThan(creation.indexOf("idempotency_status' = 'replayed'"));
  });

  it("uses precomputed source identity for CF8 replay and preserves the BKG3 booking-line shape", () => {
    expect(cf8).toContain("v_expected_source_type TEXT;");
    expect(cf8).toContain("v_expected_source_id TEXT;");
    expect(cf8).toContain("v_existing.source_type IS DISTINCT FROM v_expected_source_type");
    expect(cf8).toContain("v_existing.source_id IS DISTINCT FROM v_expected_source_id");
    expect(cf8).not.toMatch(/IF v_existing\.source_type\s*<>\s*CASE/);
    for (const sql of [cf2, cf3, cf4, cf6, cf7, cash, cf8]) {
      expect(sql).not.toContain("booking_service_lines");
      expect(sql).not.toContain("daily_cash_reconciliations");
    }
  });
});
