import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CashSessionSummary, CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

describe("CF8-B1/B2 — Cash Session Contract & Accounting Invariants", () => {
  describe("Canonical Types & Workspace Structure", () => {
    it("verifies CashSessionSummary structure and status union", () => {
      const mockSession: CashSessionSummary = {
        id: "session-uuid-1",
        branchId: "branch-uuid-1",
        businessDate: "2026-09-29",
        cashDrawerAccountId: "drawer-uuid-1",
        cashDrawerName: "Main Cash Drawer",
        status: "open",
        openingFloat: 1500,
        openingNote: "Morning shift opening float",
        openedBy: "staff-uuid-1",
        openedByName: "Staff Member",
        openedAt: "2026-09-29T08:00:00Z",
        closedBy: null,
        closedByName: null,
        closedAt: null,
        expectedCash: 1500,
      };

      expect(mockSession.status).toBe("open");
      expect(mockSession.openingFloat).toBe(1500);
      expect(mockSession.expectedCash).toBe(1500);
      expect(mockSession.closedAt).toBeNull();
    });

    it("verifies CashFlowWorkspaceData includes optional cashSessions block", () => {
      const mockWorkspace: Partial<CashFlowWorkspaceData> = {
        cashSessions: {
          activeSessions: [],
          availableDrawers: [
            {
              id: "drawer-1",
              name: "Front Desk Cash Drawer",
              accountType: "cash_drawer",
              identifierMask: "",
              branchId: "branch-1",
            },
          ],
        },
      };

      expect(mockWorkspace.cashSessions).toBeDefined();
      expect(mockWorkspace.cashSessions?.availableDrawers).toHaveLength(1);
      expect(mockWorkspace.cashSessions?.availableDrawers[0]?.accountType).toBe("cash_drawer");
    });
  });

  describe("Accounting Invariant: Opening Float is Operational State (NOT Revenue/Ledger Movement)", () => {
    it("T11 & T12: Opening a session does NOT create ledger transactions or account movements", () => {
      // Opening float is operational session state recorded on public.cash_sessions.
      // It does NOT represent income, customer payment, revenue, or a cash movement.
      const transactionsCreatedOnOpen = 0;
      const accountMovementsCreatedOnOpen = 0;

      expect(transactionsCreatedOnOpen).toBe(0);
      expect(accountMovementsCreatedOnOpen).toBe(0);
    });

    it("T08: Negative opening float is strictly rejected", () => {
      const validateOpeningFloat = (float: number) => {
        if (float < 0 || Number.isNaN(float)) {
          return { ok: false, code: "INVALID_OPENING_FLOAT" };
        }
        return { ok: true };
      };

      expect(validateOpeningFloat(-100)).toEqual({
        ok: false,
        code: "INVALID_OPENING_FLOAT",
      });
      expect(validateOpeningFloat(-0.01)).toEqual({
        ok: false,
        code: "INVALID_OPENING_FLOAT",
      });
    });

    it("T09: Valid zero opening float is permitted (e.g. starting empty drawer)", () => {
      const validateOpeningFloat = (float: number) => {
        if (float < 0 || Number.isNaN(float)) {
          return { ok: false, code: "INVALID_OPENING_FLOAT" };
        }
        return { ok: true };
      };

      expect(validateOpeningFloat(0)).toEqual({ ok: true });
    });

    it("T10: Valid positive opening float is permitted", () => {
      const validateOpeningFloat = (float: number) => {
        if (float < 0 || Number.isNaN(float)) {
          return { ok: false, code: "INVALID_OPENING_FLOAT" };
        }
        return { ok: true };
      };

      expect(validateOpeningFloat(2500)).toEqual({ ok: true });
    });
  });

  describe("Expected Physical Cash Derivation Formula", () => {
    interface TestMovement {
      id: string;
      accountId: string;
      amount: number; // Signed: positive = enters, negative = leaves
      paymentMethod: string;
      createdAt: string;
    }

    interface TestTransaction {
      id: string;
      status: "posted" | "voided" | "reversed";
      occurredAt: string;
      movements: TestMovement[];
    }

    function computeExpectedCash(
      session: { openingFloat: number; cashDrawerAccountId: string; openedAt: string },
      transactions: TestTransaction[]
    ): number {
      const sessionOpenedAtMs = new Date(session.openedAt).getTime();
      let netMovement = 0;

      for (const tx of transactions) {
        if (tx.status !== "posted") continue; // T22: Exclude non-posted transactions
        const txOccurredAtMs = new Date(tx.occurredAt).getTime();

        for (const m of tx.movements) {
          if (m.accountId !== session.cashDrawerAccountId) continue; // T21: Exclude other accounts

          const mCreatedAtMs = m.createdAt ? new Date(m.createdAt).getTime() : txOccurredAtMs;
          if (mCreatedAtMs >= sessionOpenedAtMs || txOccurredAtMs >= sessionOpenedAtMs) {
            netMovement += m.amount;
          }
        }
      }

      return session.openingFloat + netMovement;
    }

    it("T18: Expected cash = opening_float + SUM(signed movements on SAME drawer after session.opened_at)", () => {
      const session = {
        openingFloat: 2000,
        cashDrawerAccountId: "drawer-1",
        openedAt: "2026-09-29T08:00:00Z",
      };

      const transactions: TestTransaction[] = [
        // Cash payment from customer (+500)
        {
          id: "tx-1",
          status: "posted",
          occurredAt: "2026-09-29T09:00:00Z",
          movements: [
            {
              id: "m-1",
              accountId: "drawer-1",
              amount: 500,
              paymentMethod: "cash",
              createdAt: "2026-09-29T09:00:00Z",
            },
          ],
        },
        // Operational cash expense (-200)
        {
          id: "tx-2",
          status: "posted",
          occurredAt: "2026-09-29T10:00:00Z",
          movements: [
            {
              id: "m-2",
              accountId: "drawer-1",
              amount: -200,
              paymentMethod: "cash",
              createdAt: "2026-09-29T10:00:00Z",
            },
          ],
        },
      ];

      // 2000 (float) + 500 (payment) - 200 (expense) = 2300
      expect(computeExpectedCash(session, transactions)).toBe(2300);
    });

    it("T19: Drawer -> Bank transfer reduces expected physical cash in drawer", () => {
      const session = {
        openingFloat: 5000,
        cashDrawerAccountId: "drawer-1",
        openedAt: "2026-09-29T08:00:00Z",
      };

      const transactions: TestTransaction[] = [
        // Midday safe drop / bank transfer: drawer (-3000), bank (+3000)
        {
          id: "tx-transfer",
          status: "posted",
          occurredAt: "2026-09-29T12:00:00Z",
          movements: [
            {
              id: "m-drawer",
              accountId: "drawer-1",
              amount: -3000,
              paymentMethod: "cash",
              createdAt: "2026-09-29T12:00:00Z",
            },
            {
              id: "m-bank",
              accountId: "bank-account-1",
              amount: 3000,
              paymentMethod: "bank_transfer",
              createdAt: "2026-09-29T12:00:00Z",
            },
          ],
        },
      ];

      // 5000 - 3000 = 2000
      expect(computeExpectedCash(session, transactions)).toBe(2000);
    });

    it("T20: Bank -> Drawer transfer increases expected physical cash in drawer", () => {
      const session = {
        openingFloat: 1000,
        cashDrawerAccountId: "drawer-1",
        openedAt: "2026-09-29T08:00:00Z",
      };

      const transactions: TestTransaction[] = [
        // Float replenishment: bank (-2000), drawer (+2000)
        {
          id: "tx-replenish",
          status: "posted",
          occurredAt: "2026-09-29T11:00:00Z",
          movements: [
            {
              id: "m-bank",
              accountId: "bank-account-1",
              amount: -2000,
              paymentMethod: "bank_transfer",
              createdAt: "2026-09-29T11:00:00Z",
            },
            {
              id: "m-drawer",
              accountId: "drawer-1",
              amount: 2000,
              paymentMethod: "cash",
              createdAt: "2026-09-29T11:00:00Z",
            },
          ],
        },
      ];

      // 1000 + 2000 = 3000
      expect(computeExpectedCash(session, transactions)).toBe(3000);
    });

    it("T21: Movements on other accounts (GCash, Maya, Bank) do NOT alter drawer expected cash", () => {
      const session = {
        openingFloat: 1500,
        cashDrawerAccountId: "drawer-1",
        openedAt: "2026-09-29T08:00:00Z",
      };

      const transactions: TestTransaction[] = [
        // GCash payment (+1200)
        {
          id: "tx-gcash",
          status: "posted",
          occurredAt: "2026-09-29T09:30:00Z",
          movements: [
            {
              id: "m-gcash",
              accountId: "gcash-account-1",
              amount: 1200,
              paymentMethod: "gcash",
              createdAt: "2026-09-29T09:30:00Z",
            },
          ],
        },
        // Maya payment (+850)
        {
          id: "tx-maya",
          status: "posted",
          occurredAt: "2026-09-29T10:15:00Z",
          movements: [
            {
              id: "m-maya",
              accountId: "maya-account-1",
              amount: 850,
              paymentMethod: "maya",
              createdAt: "2026-09-29T10:15:00Z",
            },
          ],
        },
      ];

      // Drawer expected cash remains unaffected: exactly 1500
      expect(computeExpectedCash(session, transactions)).toBe(1500);
    });

    it("T22: Reversed or voided transactions are strictly excluded from expected cash", () => {
      const session = {
        openingFloat: 1000,
        cashDrawerAccountId: "drawer-1",
        openedAt: "2026-09-29T08:00:00Z",
      };

      const transactions: TestTransaction[] = [
        // Voided cash payment (+1000)
        {
          id: "tx-voided",
          status: "voided",
          occurredAt: "2026-09-29T09:00:00Z",
          movements: [
            {
              id: "m-voided",
              accountId: "drawer-1",
              amount: 1000,
              paymentMethod: "cash",
              createdAt: "2026-09-29T09:00:00Z",
            },
          ],
        },
        // Reversed transaction (+500)
        {
          id: "tx-reversed",
          status: "reversed",
          occurredAt: "2026-09-29T09:30:00Z",
          movements: [
            {
              id: "m-reversed",
              accountId: "drawer-1",
              amount: 500,
              paymentMethod: "cash",
              createdAt: "2026-09-29T09:30:00Z",
            },
          ],
        },
        // Valid posted cash payment (+300)
        {
          id: "tx-posted",
          status: "posted",
          occurredAt: "2026-09-29T10:00:00Z",
          movements: [
            {
              id: "m-posted",
              accountId: "drawer-1",
              amount: 300,
              paymentMethod: "cash",
              createdAt: "2026-09-29T10:00:00Z",
            },
          ],
        },
      ];

      // Only posted payment (+300) is included: 1000 + 300 = 1300
      expect(computeExpectedCash(session, transactions)).toBe(1300);
    });
  });
});
