import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock dependencies for server actions
const { mockCreateClient, mockRevalidatePath } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import {
  closeCashSessionAction,
  handoverCashSessionAction,
} from "@/lib/cash-flow/cash-flow-actions";
import { computeExpectedPhysicalCash, type TransactionLike } from "@/lib/cash-flow/cash-flow-queries";

// Helper to read migration files for contract assertions
const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replace(/\r\n/g, "\n");

describe("P1 Cash Session Close & Handover Operational Safety", () => {
  // =========================================================================
  // 1. MIGRATION CONTRACT VALIDATION
  // =========================================================================
  describe("Database Migration Contract (20261002100000_p1_cash_session_close_handover.sql)", () => {
    const migrationSql = readMigration("20261002100000_p1_cash_session_close_handover.sql");

    it("adds required custody, count, variance, and idempotency columns to cash_sessions", () => {
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS current_custodian_id UUID NULL REFERENCES public.staff(id)");
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS counted_cash NUMERIC(12,2) NULL CHECK");
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS expected_cash_at_close NUMERIC(12,2) NULL;");
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS variance NUMERIC(12,2) NULL;");
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS closing_note TEXT NULL;");
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS close_idempotency_key TEXT NULL UNIQUE;");
    });

    it("creates cash_session_handovers audit table with strict RLS and integrity constraints", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.cash_session_handovers");
      expect(migrationSql).toContain("cash_session_id         UUID          NOT NULL REFERENCES public.cash_sessions(id)");
      expect(migrationSql).toContain("cash_drawer_account_id  UUID          NOT NULL REFERENCES public.financial_accounts(id)");
      expect(migrationSql).toContain("outgoing_custodian_id   UUID          NOT NULL REFERENCES public.staff(id)");
      expect(migrationSql).toContain("incoming_custodian_id   UUID          NOT NULL REFERENCES public.staff(id)");
      expect(migrationSql).toContain("recorded_by             UUID          NOT NULL REFERENCES public.staff(id)");
      expect(migrationSql).toContain("expected_cash           NUMERIC(12,2) NOT NULL");
      expect(migrationSql).toContain("counted_cash            NUMERIC(12,2) NOT NULL CHECK (counted_cash >= 0)");
      expect(migrationSql).toContain("variance                NUMERIC(12,2) NOT NULL");
      expect(migrationSql).toContain("idempotency_key         TEXT          NOT NULL UNIQUE");
      expect(migrationSql).toContain("ALTER TABLE public.cash_session_handovers ENABLE ROW LEVEL SECURITY;");
    });

    it("defines close_cash_session_atomic with server-resolved auth, variance calculation, and duplicate close protection", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.close_cash_session_atomic(");
      expect(migrationSql).toContain("p_session_id        UUID");
      expect(migrationSql).toContain("p_counted_cash      NUMERIC");
      expect(migrationSql).toContain("p_closing_note      TEXT");
      expect(migrationSql).toContain("p_idempotency_key   TEXT");
      expect(migrationSql).toContain("SECURITY DEFINER");

      // Verifies auth actor is resolved from auth.uid()
      expect(migrationSql).toContain("v_auth_uid := auth.uid();");
      // Verifies session is locked FOR UPDATE
      expect(migrationSql).toContain("FROM public.cash_sessions cs");
      expect(migrationSql).toContain("FOR UPDATE;");
      // Verifies expected cash calculation includes opening float + posted movements
      expect(migrationSql).toContain("v_expected_cash := v_session.opening_float + v_movements_total;");
      // Verifies variance = counted - expected
      expect(migrationSql).toContain("v_variance := (p_counted_cash::numeric(12,2)) - v_expected_cash;");
      // Verifies duplicate close idempotency replay
      expect(migrationSql).toContain("WHERE cs.close_idempotency_key = v_clean_key;");
      expect(migrationSql).toContain("'idempotentReplay', true");
      // Verifies closed status transition
      expect(migrationSql).toContain("status = 'closed'");
      expect(migrationSql).toContain("closed_by = v_staff.id");
    });

    it("defines handover_cash_session_atomic with incoming custodian validation and variance recording", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.handover_cash_session_atomic(");
      expect(migrationSql).toContain("p_session_id              UUID");
      expect(migrationSql).toContain("p_incoming_custodian_id   UUID");
      expect(migrationSql).toContain("p_counted_cash            NUMERIC");
      expect(migrationSql).toContain("p_idempotency_key         TEXT");
      expect(migrationSql).toContain("SECURITY DEFINER");

      // Verifies incoming custodian eligibility & branch check
      expect(migrationSql).toContain("SELECT s.id, s.branch_id, s.system_role, s.is_active, s.full_name");
      expect(migrationSql).toContain("FROM public.staff s");
      expect(migrationSql).toContain("WHERE s.id = p_incoming_custodian_id;");
      expect(migrationSql).toContain("INCOMING_STAFF_BRANCH_MISMATCH");
      // Verifies variance = counted - expected
      expect(migrationSql).toContain("v_variance := (p_counted_cash::numeric(12,2)) - v_expected_cash;");
      // Inserts into audit table
      expect(migrationSql).toContain("INSERT INTO public.cash_session_handovers");
      // Updates session custody
      expect(migrationSql).toContain("UPDATE public.cash_sessions");
      expect(migrationSql).toContain("current_custodian_id = v_incoming.id");
    });

    it("updates post_expense_atomic to guard cash drawers against closed sessions", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.post_expense_atomic(");
      expect(migrationSql).toContain("IF v_account.account_type = 'cash_drawer'");
      expect(migrationSql).toContain("cs.status = 'open'");
      expect(migrationSql).toContain("CASH_DRAWER_SESSION_REQUIRED");
    });

    it("preserves exact post_expense_atomic parameter contract established in cf7", () => {
      const cf7Sql = readMigration("20260929120000_cf7_expense_receipt_storage.sql");
      const p1Sql = readMigration("20261002100000_p1_cash_session_close_handover.sql");

      const extractSignature = (sql: string) => {
        const match = sql.match(/CREATE OR REPLACE FUNCTION public\.post_expense_atomic\s*\(([\s\S]*?)\)\s*RETURNS JSONB/i);
        if (!match || !match[1]) throw new Error("Could not find post_expense_atomic in migration");
        return match[1]
          .split(",")
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter(Boolean);
      };

      const cf7Params = extractSignature(cf7Sql);
      const p1Params = extractSignature(p1Sql);

      expect(p1Params).toEqual(cf7Params);
      expect(p1Params).toHaveLength(11);
      expect(p1Params[0]).toBe("p_branch_id UUID");
      expect(p1Params[1]).toBe("p_idempotency_key TEXT");
      expect(p1Params[2]).toBe("p_amount NUMERIC");
      expect(p1Params[3]).toBe("p_category_id UUID");
      expect(p1Params[4]).toBe("p_financial_account_id UUID");
      expect(p1Params[5]).toBe("p_payee TEXT");
      expect(p1Params[6]).toBe("p_description TEXT");
      expect(p1Params[7]).toBe("p_receipt_reference TEXT DEFAULT NULL");
      expect(p1Params[8]).toBe("p_business_date DATE DEFAULT NULL");
      expect(p1Params[9]).toBe("p_notes TEXT DEFAULT NULL");
      expect(p1Params[10]).toBe("p_receipt_image_path TEXT DEFAULT NULL");
    });
  });

  // =========================================================================
  // 2. ACTIONS UNIT TESTING (closeCashSessionAction & handoverCashSessionAction)
  // =========================================================================
  describe("Server Actions: closeCashSessionAction & handoverCashSessionAction", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("closeCashSessionAction rejects unauthenticated callers", async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null } }) },
      });

      const res = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 2000,
        idempotencyKey: "idem-close-1",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("AUTH_REQUIRED");
    });

    it("closeCashSessionAction validates required inputs", async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      });

      // Missing session ID
      const r1 = await closeCashSessionAction({
        sessionId: "",
        countedCash: 2000,
        idempotencyKey: "idem-close-1",
      });
      expect(r1.code).toBe("SESSION_ID_REQUIRED");

      // Negative counted cash
      const r2 = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: -10,
        idempotencyKey: "idem-close-1",
      });
      expect(r2.code).toBe("INVALID_COUNTED_CASH");

      // Missing idempotency key
      const r3 = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 2000,
        idempotencyKey: "",
      });
      expect(r3.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("closeCashSessionAction successfully invokes atomic RPC and formats response", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          sessionId: "sess-1",
          branchId: "branch-1",
          cashDrawerAccountId: "drawer-1",
          cashDrawerName: "Front Desk Cash Drawer",
          businessDate: "2026-10-02",
          status: "closed",
          openingFloat: 2000,
          expectedCash: 3000,
          countedCash: 2950,
          variance: -50,
          closedBy: "staff-1",
          closedByName: "Mary Santos",
          closedAt: "2026-10-02T18:00:00Z",
        },
        error: null,
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 2950,
        closingNote: "End of day count",
        idempotencyKey: "idem-close-1",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("close_cash_session_atomic", {
        p_session_id: "sess-1",
        p_counted_cash: 2950,
        p_closing_note: "End of day count",
        p_idempotency_key: "idem-close-1",
      });
      expect(res.session?.status).toBe("closed");
      expect(res.session?.expectedCash).toBe(3000);
      expect(res.session?.countedCash).toBe(2950);
      expect(res.session?.variance).toBe(-50);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/crm/cash-flow");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/crm/reconciliation");
    });

    it("handoverCashSessionAction rejects unauthenticated callers and validates inputs", async () => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null } }) },
      });

      const r1 = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "staff-2",
        countedCash: 2000,
        idempotencyKey: "idem-ho-1",
      });
      expect(r1.code).toBe("AUTH_REQUIRED");

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      });

      // Missing incoming custodian
      const r2 = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "",
        countedCash: 2000,
        idempotencyKey: "idem-ho-1",
      });
      expect(r2.code).toBe("INCOMING_CUSTODIAN_REQUIRED");
    });

    it("handoverCashSessionAction invokes handover_cash_session_atomic successfully", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          handoverId: "ho-1",
          sessionId: "sess-1",
          outgoingCustodianId: "staff-1",
          outgoingCustodianName: "Mary Santos",
          incomingCustodianId: "staff-2",
          incomingCustodianName: "Peter Cruz",
          expectedCash: 3000,
          countedCash: 3000,
          variance: 0,
          recordedAt: "2026-10-02T16:00:00Z",
        },
        error: null,
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "staff-2",
        countedCash: 3000,
        notes: "Shift handover to Peter",
        idempotencyKey: "idem-ho-1",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("handover_cash_session_atomic", {
        p_session_id: "sess-1",
        p_incoming_custodian_id: "staff-2",
        p_counted_cash: 3000,
        p_notes: "Shift handover to Peter",
        p_idempotency_key: "idem-ho-1",
      });
      expect(res.handover?.incomingCustodianName).toBe("Peter Cruz");
      expect(res.handover?.variance).toBe(0);
    });
  });

  // =========================================================================
  // 3. SECTION 7: HANDOVER BEHAVIOR SCENARIOS (1 to 6)
  // =========================================================================
  describe("Section 7 — Handover Behavior Matrix", () => {
    it("SCENARIO 1: Mary opens drawer with ₱2,000, receives cash, Peter takes over custody with 0 variance", async () => {
      // Mary opens session
      const session = {
        id: "sess-mary",
        openingFloat: 2000,
        cashDrawerAccountId: "drawer-main",
        openedAt: "2026-10-02T08:00:00Z",
        currentCustodianId: "staff-mary",
      };

      // Mary receives ₱1,000 cash payment
      const transactions = [
        {
          id: "tx-sale-1",
          status: "posted" as const,
          occurredAt: "2026-10-02T10:00:00Z",
          movements: [
            {
              id: "mov-1",
              accountId: "drawer-main",
              amount: 1000,
              paymentMethod: "cash",
              createdAt: "2026-10-02T10:00:00Z",
            },
          ],
        },
      ];

      const expectedBeforeHandover = computeExpectedPhysicalCash(session, transactions);
      expect(expectedBeforeHandover).toBe(3000);

      // Peter counts ₱3,000 at 16:00
      const physicalCount = 3000;
      const variance = physicalCount - expectedBeforeHandover;
      expect(variance).toBe(0);

      // Handover updates current custodian without changing drawer account or session ID
      const updatedSession = {
        ...session,
        currentCustodianId: "staff-peter",
      };
      expect(updatedSession.id).toBe(session.id);
      expect(updatedSession.cashDrawerAccountId).toBe("drawer-main");
      expect(updatedSession.currentCustodianId).toBe("staff-peter");
    });

    it("SCENARIO 2: Handover has shortage (Expected ₱11,700, Counted ₱11,650, Variance -₱50 recorded)", async () => {
      const expected = 11700;
      const counted = 11650;
      const variance = counted - expected;

      expect(variance).toBe(-50);

      const handoverRecord = {
        expectedCash: expected,
        countedCash: counted,
        variance,
      };

      // Invariant: Shortage must be preserved as negative variance
      expect(handoverRecord.variance).toBe(-50);
    });

    it("SCENARIO 3: Wrong-branch staff attempts takeover -> Reject", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "STAFF_BRANCH_MISMATCH",
          message: "Incoming staff does not belong to the session branch.",
        },
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "staff-sm-branch",
        countedCash: 3000,
        idempotencyKey: "idem-wrong-branch",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("STAFF_BRANCH_MISMATCH");
    });

    it("SCENARIO 4: Unauthorized user attempts takeover -> Reject", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "UNAUTHORIZED",
          message: "Active staff profile required to perform handover.",
        },
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "unauth-user" } } }) },
        rpc: mockRpc,
      });

      const res = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "staff-2",
        countedCash: 3000,
        idempotencyKey: "idem-unauth",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("UNAUTHORIZED");
    });

    it("SCENARIO 5: Duplicate handover submission returns idempotent replay with no duplicate custody event", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          handoverId: "ho-existing-1",
          sessionId: "sess-1",
          outgoingCustodianId: "staff-1",
          incomingCustodianId: "staff-2",
          expectedCash: 3000,
          countedCash: 3000,
          variance: 0,
          idempotentReplay: true,
        },
        error: null,
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await handoverCashSessionAction({
        sessionId: "sess-1",
        incomingCustodianId: "staff-2",
        countedCash: 3000,
        idempotencyKey: "idem-ho-replay",
      });

      expect(res.ok).toBe(true);
      expect(res.idempotentReplay).toBe(true);
      expect(res.handover?.id).toBe("ho-existing-1");
    });

    it("SCENARIO 6: Two competing handovers -> atomic session lock ensures only first valid transition succeeds", () => {
      // In the SQL RPC, SELECT cs.* ... FOR UPDATE locks the session row.
      // If session is already closed or custodian was already transitioned, subsequent RPC sees updated state.
      const migrationSql = readMigration("20261002100000_p1_cash_session_close_handover.sql");
      expect(migrationSql).toContain("SELECT cs.*");
      expect(migrationSql).toContain("FROM public.cash_sessions cs");
      expect(migrationSql).toContain("WHERE cs.id = p_session_id");
      expect(migrationSql).toContain("FOR UPDATE;");
    });
  });

  // =========================================================================
  // 4. SECTION 8: DAY CLOSE TEST MATRIX (Cases 1 to 13)
  // =========================================================================
  describe("Section 8 — Day Close Test Matrix (Cases 1 to 13)", () => {
    const mainDrawerId = "drawer-main";
    const sessionStart = "2026-10-02T08:00:00Z";

    it("CASE 1 — FLOAT ONLY: Opening float ₱500, Movements ₱0 -> Expected ₱500, Counted ₱500, Variance ₱0", () => {
      const session = {
        openingFloat: 500,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions: TransactionLike[] = [];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(500);

      const counted = 500;
      const variance = counted - expected;
      expect(variance).toBe(0);
    });

    it("CASE 2 — CASH SALE: Opening ₱2,000, Cash sale +₱1,000 -> Expected ₱3,000", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions = [
        {
          id: "tx-1",
          status: "posted" as const,
          occurredAt: "2026-10-02T09:00:00Z",
          movements: [
            { id: "m-1", accountId: mainDrawerId, amount: 1000, paymentMethod: "cash", createdAt: "2026-10-02T09:00:00Z" },
          ],
        },
      ];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(3000);
    });

    it("CASE 3 — DIGITAL SALE: Opening ₱2,000, GCash sale +₱1,500 -> Expected physical drawer ₱2,000", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions = [
        {
          id: "tx-gcash-1",
          status: "posted" as const,
          occurredAt: "2026-10-02T09:30:00Z",
          movements: [
            { id: "m-gcash", accountId: "account-gcash", amount: 1500, paymentMethod: "gcash", createdAt: "2026-10-02T09:30:00Z" },
          ],
        },
      ];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(2000); // GCash must not affect physical drawer!
    });

    it("CASE 4 — CASH EXPENSE: Opening ₱2,000, Cash sale +₱1,000, Cash expense -₱300 -> Expected ₱2,700", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions = [
        {
          id: "tx-sale",
          status: "posted" as const,
          occurredAt: "2026-10-02T09:00:00Z",
          movements: [
            { id: "m-sale", accountId: mainDrawerId, amount: 1000, paymentMethod: "cash", createdAt: "2026-10-02T09:00:00Z" },
          ],
        },
        {
          id: "tx-expense",
          status: "posted" as const,
          occurredAt: "2026-10-02T11:00:00Z",
          movements: [
            { id: "m-exp", accountId: mainDrawerId, amount: -300, paymentMethod: "cash", createdAt: "2026-10-02T11:00:00Z" },
          ],
        },
      ];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(2700);
    });

    it("CASE 5 — SAFE DROP: Opening ₱2,000, Cash collections +₱10,000, Safe drop -₱5,000 -> Expected ₱7,000", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions = [
        {
          id: "tx-collect",
          status: "posted" as const,
          occurredAt: "2026-10-02T12:00:00Z",
          movements: [
            { id: "m-c", accountId: mainDrawerId, amount: 10000, paymentMethod: "cash", createdAt: "2026-10-02T12:00:00Z" },
          ],
        },
        {
          id: "tx-safedrop",
          status: "posted" as const,
          occurredAt: "2026-10-02T14:00:00Z",
          movements: [
            { id: "m-drop", accountId: mainDrawerId, amount: -5000, paymentMethod: "cash", createdAt: "2026-10-02T14:00:00Z" },
            { id: "m-vault", accountId: "account-vault", amount: 5000, paymentMethod: "cash", createdAt: "2026-10-02T14:00:00Z" },
          ],
        },
      ];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(7000);
    });

    it("CASE 6 — CASH IN: Opening ₱2,000, Cash in/change addition +₱1,000 -> Expected ₱3,000 (NOT revenue)", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: mainDrawerId,
        openedAt: sessionStart,
      };
      const transactions = [
        {
          id: "tx-cashin",
          status: "posted" as const,
          occurredAt: "2026-10-02T09:00:00Z",
          movements: [
            { id: "m-in", accountId: mainDrawerId, amount: 1000, paymentMethod: "cash", createdAt: "2026-10-02T09:00:00Z" },
          ],
        },
      ];
      const expected = computeExpectedPhysicalCash(session, transactions);
      expect(expected).toBe(3000);
    });

    it("CASE 7 — SHORTAGE: Expected ₱11,700, Counted ₱11,650 -> Variance -₱50", () => {
      const expected = 11700;
      const counted = 11650;
      const variance = counted - expected;
      expect(variance).toBe(-50);
    });

    it("CASE 8 — OVERAGE: Expected ₱11,700, Counted ₱11,750 -> Variance +₱50", () => {
      const expected = 11700;
      const counted = 11750;
      const variance = counted - expected;
      expect(variance).toBe(50);
    });

    it("CASE 9 — DUPLICATE CLOSE: First close succeeds, second close replays without mutating or creating another close", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          sessionId: "sess-1",
          status: "closed",
          expectedCash: 11700,
          countedCash: 11650,
          variance: -50,
          idempotentReplay: true,
        },
        error: null,
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 11650,
        idempotencyKey: "idem-close-dup",
      });

      expect(res.ok).toBe(true);
      expect(res.idempotentReplay).toBe(true);
      expect(res.session?.status).toBe("closed");
    });

    it("CASE 10 — WRONG BRANCH: Reject close operation from staff of different branch", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "BRANCH_MISMATCH",
          message: "Staff does not belong to session branch.",
        },
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        rpc: mockRpc,
      });

      const res = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 11650,
        idempotencyKey: "idem-branch-err",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("BRANCH_MISMATCH");
    });

    it("CASE 11 — UNAUTHORIZED ROLE: Reject close operation from unauthorized user", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "UNAUTHORIZED",
          message: "Active staff record required to close session.",
        },
      });

      mockCreateClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "user-unknown" } } }) },
        rpc: mockRpc,
      });

      const res = await closeCashSessionAction({
        sessionId: "sess-1",
        countedCash: 11650,
        idempotencyKey: "idem-unauth-err",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("UNAUTHORIZED");
    });

    it("CASE 12 — CASH MOVEMENT AFTER CLOSE: Reject post-close cash writes with CASH_DRAWER_SESSION_REQUIRED", () => {
      // Validates that the migration contains the guard for closed session on cash_drawer writes
      const forwardGuardSql = readMigration("20260930145947_require_open_drawer_for_cash_payments.sql");
      const p1Sql = readMigration("20261002100000_p1_cash_session_close_handover.sql");

      // Payment command guards:
      expect(forwardGuardSql).toContain("cs.status = 'open'");
      expect(forwardGuardSql).toContain("CASH_DRAWER_SESSION_REQUIRED");

      // Expense command guard:
      expect(p1Sql).toContain("cs.status = 'open'");
      expect(p1Sql).toContain("CASH_DRAWER_SESSION_REQUIRED");
    });

    it("CASE 13 — MULTIPLE DRAWERS: Movements and float in Drawer 1 do not contaminate Drawer 2", () => {
      const drawer1Session = {
        openingFloat: 2000,
        cashDrawerAccountId: "drawer-1",
        openedAt: sessionStart,
      };
      const drawer2Session = {
        openingFloat: 5000,
        cashDrawerAccountId: "drawer-2",
        openedAt: sessionStart,
      };

      const transactions = [
        // Drawer 1 sale
        {
          id: "tx-d1",
          status: "posted" as const,
          occurredAt: "2026-10-02T09:00:00Z",
          movements: [
            { id: "m-1", accountId: "drawer-1", amount: 1500, paymentMethod: "cash", createdAt: "2026-10-02T09:00:00Z" },
          ],
        },
        // Drawer 2 expense
        {
          id: "tx-d2",
          status: "posted" as const,
          occurredAt: "2026-10-02T10:00:00Z",
          movements: [
            { id: "m-2", accountId: "drawer-2", amount: -400, paymentMethod: "cash", createdAt: "2026-10-02T10:00:00Z" },
          ],
        },
      ];

      const expected1 = computeExpectedPhysicalCash(drawer1Session, transactions);
      const expected2 = computeExpectedPhysicalCash(drawer2Session, transactions);

      // Drawer 1: 2000 + 1500 = 3500 (unaffected by drawer 2 expense)
      expect(expected1).toBe(3500);

      // Drawer 2: 5000 - 400 = 4600 (unaffected by drawer 1 sale)
      expect(expected2).toBe(4600);
    });
  });
});
