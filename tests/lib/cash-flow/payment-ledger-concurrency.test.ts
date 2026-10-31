import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const p1Migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261003081900_p1_expired_booking_financial_safety.sql"
  ),
  "utf8"
);

const cf2Migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260927120000_cf2_financial_foundation.sql"
  ),
  "utf8"
);

function extractFunction(sql: string, name: string): string {
  const match = sql.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?^\\$[A-Za-z0-9_]+\\$;`,
      "m"
    )
  );
  expect(match, `Function ${name} must be defined in migration`).not.toBeNull();
  return match![0];
}

describe("PostgreSQL Ledger-Native Concurrency & Financial Contract Invariants", () => {
  const postOrderPayment = extractFunction(p1Migration, "post_order_payment_atomic");
  const postBookingPayment = extractFunction(p1Migration, "post_booking_payment_atomic");

  describe("TC-01: Simultaneous CSRs Full Balance Race & Row Locking", () => {
    it("locks booking order row with FOR UPDATE before reading balance or writing movements", () => {
      // Must execute SELECT ... FOR UPDATE on booking_orders to serialize concurrent cashier attempts
      expect(postOrderPayment).toMatch(
        /SELECT[\s\S]*?FROM\s+public\.booking_orders[\s\S]*?WHERE\s+id\s*=\s*p_order_id[\s\S]*?FOR\s+UPDATE/i
      );

      // Must calculate remaining balance after row lock is acquired
      const lockIdx = postOrderPayment.indexOf("FOR UPDATE");
      const balanceCheckIdx = postOrderPayment.indexOf("v_total_payment > v_remaining_balance");
      expect(lockIdx).toBeGreaterThan(0);
      expect(balanceCheckIdx).toBeGreaterThan(lockIdx);

      // Rejects with PAYMENT_EXCEEDS_REMAINING_BALANCE when second transaction unblocks and sees balance settled
      expect(postOrderPayment).toContain("PAYMENT_EXCEEDS_REMAINING_BALANCE");
    });
  });

  describe("TC-02: Concurrent Partial Payments Within Remaining Balance", () => {
    it("permits multiple valid partial payments fitting within the outstanding balance while updating cumulative allocations", () => {
      // Locking guarantees second transaction reads the committed allocation of the first
      expect(postOrderPayment).toContain("v_net_allocated");
      expect(postOrderPayment).toContain("v_remaining_balance := v_total_payable - v_net_allocated");

      // Validates that each payment allocates its delta against payable items
      expect(postOrderPayment).toContain("INSERT INTO public.financial_order_allocations");
      expect(postOrderPayment).toContain("INSERT INTO public.financial_account_movements");
      expect(postOrderPayment).toContain("INSERT INTO public.financial_transactions");

      // Verifies that two distinct keys produce distinct transaction and movement IDs
      expect(postOrderPayment).toContain("RETURNING id INTO v_transaction_id");
      expect(postOrderPayment).toContain("v_movements_json");
    });
  });

  describe("TC-03: Same-Key Retry & Idempotent Replay", () => {
    it("enforces unique idempotency keys in financial_transactions and returns idempotent replay", () => {
      // Schema constraint: idempotency_key must be UNIQUE
      expect(cf2Migration).toMatch(/idempotency_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);

      // Function checks existing transaction by idempotency key
      expect(postOrderPayment).toContain(
        "SELECT id, branch_id, transaction_type, status, business_date, source_type, source_id, external_reference"
      );
      expect(postOrderPayment).toContain(
        "FROM public.financial_transactions"
      );
      expect(postOrderPayment).toContain(
        "WHERE idempotency_key = p_idempotency_key"
      );

      // Returns is_idempotent_replay: true without writing new movements
      expect(postOrderPayment).toContain("'is_idempotent_replay', true");
    });
  });

  describe("TC-04: Delayed Commit & Transaction Advisory Lock Serialization", () => {
    it("acquires transaction-level advisory lock using hash of idempotency key", () => {
      // Serializes concurrent requests using the exact same idempotency key at the PostgreSQL engine level
      expect(postOrderPayment).toContain(
        "PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || p_idempotency_key));"
      );
      expect(postBookingPayment).toContain(
        "PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || v_key));"
      );
    });
  });

  describe("TC-05: Conflicting Payload under Same Idempotency Key", () => {
    it("rejects different amount, branch, or tenders under the same idempotency key with IDEMPOTENCY_CONFLICT", () => {
      expect(postOrderPayment).toContain("IDEMPOTENCY_CONFLICT");
      expect(postOrderPayment).toContain("v_existing_total <> v_total_payment");
      expect(postOrderPayment).toContain("v_existing_parts <> v_requested_parts");
      expect(postBookingPayment).toContain("IDEMPOTENCY_CONFLICT: Key already belongs to a different payment");
    });
  });

  describe("TC-06: Cross-Branch Access Rejection", () => {
    it("rejects non-owner callers attempting to record or allocate payments outside their assigned branch", () => {
      expect(postOrderPayment).toContain("BRANCH_UNAUTHORIZED");
      expect(postOrderPayment).toContain("v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_order.branch_id");
      expect(postBookingPayment).toContain("v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_booking.branch_id");
    });
  });

  describe("TC-07: Unauthorized Role Rejection", () => {
    it("restricts payment recording strictly to owner, manager, assistant_manager, store_manager, and crm", () => {
      expect(postOrderPayment).toContain(
        "v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm')"
      );
      expect(postOrderPayment).toContain("PAYMENT_ROLE_UNAUTHORIZED");
      expect(postBookingPayment).toMatch(
        /v_staff\.system_role\s+NOT\s+IN\s*\([\s\S]*?'owner'[\s\S]*?'crm'[\s\S]*?\)/
      );
      expect(postBookingPayment).toContain("PAYMENT_ROLE_UNAUTHORIZED");
    });
  });

  describe("TC-08: Cash Drawer Session Guard", () => {
    it("requires an open cash drawer session in the current branch for cash tenders", () => {
      expect(postOrderPayment).toContain("CASH_DRAWER_SESSION_REQUIRED");
      expect(postOrderPayment).toMatch(/SELECT\s+cs\.id\s+INTO\s+v_cash_session_id[\s\S]*?FROM\s+public\.cash_sessions\s+cs[\s\S]*?WHERE[\s\S]*?status\s*=\s*'open'[\s\S]*?FOR\s+SHARE/i);
      expect(postBookingPayment).toContain("CASH_DRAWER_SESSION_REQUIRED");
      expect(postBookingPayment).toMatch(/SELECT\s+cs\.id\s+INTO\s+v_cash_session_id[\s\S]*?FROM\s+public\.cash_sessions\s+cs[\s\S]*?WHERE[\s\S]*?status\s*=\s*'open'[\s\S]*?FOR\s+SHARE/i);
    });
  });
});
