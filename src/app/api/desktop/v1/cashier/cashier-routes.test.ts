import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/cash-flow/cash-flow-queries", () => ({
  getCashFlowData: vi.fn(),
}));

vi.mock("@/lib/cash-flow/payment-writer", () => ({
  recordOrderPayment: vi.fn(),
}));

vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: vi.fn(() => "2026-10-23"),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import { recordOrderPayment } from "@/lib/cash-flow/payment-writer";
import { GET as getOverview } from "./overview/route";
import { GET as getPayableOrders } from "./payable-orders/route";
import { GET as getLedger } from "./ledger/route";
import { GET as getDrawers, POST as postDrawerAction } from "./drawers/route";
import { GET as getDayClose } from "./day-close/route";
import { GET as getHistory } from "./history/route";
import { POST as postPayment } from "./payments/route";
import { POST as postExpense } from "./expenses/route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedQueries = vi.mocked(getCashFlowData);
const mockedPaymentWriter = vi.mocked(recordOrderPayment);

function createMockClient(overrides: Record<string, unknown> = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: "branch-uuid-1", name: "Main Spa" },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return {
    from: vi.fn().mockReturnValue({ select }),
    rpc: vi.fn().mockResolvedValue({ data: { ok: true, transactionId: "tx-123" }, error: null }),
    ...overrides,
  };
}

function mockAuthSuccess(client?: unknown) {
  mockedAuth.mockResolvedValue({
    ok: true as const,
    operator: {
      authUserId: "auth-user-1",
      staff: {
        id: "staff-1",
        branch_id: "branch-uuid-1",
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    },
    user: { id: "auth-user-1", email: "cashier@cradlehub.test" },
    client: (client ?? createMockClient()) as any,
  });
}

const mockWorkspaceData: any = {
  branchId: "branch-uuid-1",
  branchName: "Main Spa",
  businessDate: "2026-10-23",
  accounts: [
    {
      id: "acc-cash-1",
      name: "Main Cash Drawer",
      accountType: "cash_drawer",
      identifierMask: "CASH-01",
      branchId: "branch-uuid-1",
    },
    {
      id: "acc-gcash-1",
      name: "Front Desk GCash",
      accountType: "gcash",
      identifierMask: "0917****123",
      branchId: "branch-uuid-1",
    },
  ],
  expenseCategories: [
    { id: "cat-1", code: "supplies", name: "Supplies", description: "Consumables" },
  ],
  staffOptions: [
    { id: "staff-1", name: "Maria Santos", role: "crm" },
    { id: "staff-2", name: "Anna Reyes", role: "therapist" },
  ],
  cashSessions: {
    activeSessions: [
      {
        id: "session-1",
        branchId: "branch-uuid-1",
        businessDate: "2026-10-23",
        cashDrawerAccountId: "acc-cash-1",
        cashDrawerName: "Main Cash Drawer",
        status: "open",
        openingFloat: 2000,
        openedBy: "staff-1",
        openedByName: "Maria Santos",
        openedAt: "2026-10-23T08:00:00Z",
        expectedCash: 2500,
      },
    ],
    availableDrawers: [
      {
        id: "acc-cash-1",
        name: "Main Cash Drawer",
        accountType: "cash_drawer",
        identifierMask: "CASH-01",
      },
    ],
  },
  today: {
    kpis: {
      recordedPayments: 12450,
      paidBookingsCount: 18,
      outstandingBalance: 6250,
      needsPaymentCount: 5,
    },
    paymentMix: [
      { method: "cash", label: "Cash", amount: 7150, transactionCount: 10, percentage: 57 },
      { method: "gcash", label: "GCash", amount: 5300, transactionCount: 8, percentage: 43 },
    ],
    totalInflow: 12450,
    coverage: [],
    recentPayments: [],
  },
  ledger: {
    kpis: { inflow: 12450, outflow: 1200, netFlow: 11250, unreconciledText: "All reconciled" },
    records: [
      {
        id: "tx-1",
        dateTime: "2026-10-23 10:25 AM",
        reference: "R-0018",
        customerSource: "Maria Santos",
        category: "service",
        method: "Cash",
        inflow: 500,
        outflow: null,
        netEffect: 500,
        status: "posted",
      },
    ],
    totalRecords: 1,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  },
  dayClose: {
    businessDate: "2026-10-23",
    isBalanced: true,
    readyForReview: true,
    lastUpdatedText: "Just now",
    reconciliationStatus: "draft",
    expectedCash: 2500,
    actualCash: null,
    cashVariance: null,
    channelVariance: null,
    recordedInflow: 12450,
    recordedOutflow: 1200,
    netPosition: 11250,
    openIssuesCount: 0,
    paymentBreakdown: [],
    coverageCategories: [],
    timeline: [],
    isFinalizationSupported: false,
  },
  history: {
    closedDaysThisMonth: 12,
    totalInflowThisMonth: 150000,
    totalOutflowThisMonth: 14000,
    reviewExceptions: 0,
    records: [],
    auditTrail: [],
  },
  payableOrders: [
    {
      id: "order-1",
      sourceKind: "booking_order",
      paymentEligible: true,
      orderNumber: "BKG-1045",
      customerName: "Maria Santos",
      serviceDescription: "Gel Manicure",
      totalAmount: 500,
      amountPaid: 0,
      remainingBalance: 500,
      bookingDate: "2026-10-23",
      paymentStatus: "unpaid",
    },
    {
      id: "order-2",
      sourceKind: "booking_order",
      paymentEligible: true,
      orderNumber: "BKG-1037",
      customerName: "Nina Garcia",
      serviceDescription: "Nail Care",
      totalAmount: 1200,
      amountPaid: 1200,
      remainingBalance: 0,
      bookingDate: "2026-10-23",
      paymentStatus: "paid",
    },
  ],
};

describe("Cashier Desktop API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication and Branch Isolation Guards", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockedAuth.mockResolvedValueOnce({
        ok: false as const,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/overview");
      const res = await getOverview(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("rejects operators without an active staff branch with 403", async () => {
      mockedAuth.mockResolvedValueOnce({
        ok: true as const,
        operator: {
          authUserId: "user-1",
          staff: null,
          staffRole: null,
          isDevBypass: false,
        },
        user: { id: "user-1" },
        client: createMockClient() as any,
      });

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/overview");
      const res = await getOverview(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("STAFF_NOT_FOUND");
    });
  });

  describe("GET /api/desktop/v1/cashier/overview", () => {
    it("returns truthful branch overview KPIs and payment mix", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/overview");
      const res = await getOverview(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.branchName).toBe("Main Spa");
      expect(json.data.businessDate).toBe("2026-10-23");
      expect(json.data.kpis.totalCollected).toBe(12450);
      expect(json.data.kpis.pendingAmount).toBe(6250);
      expect(json.data.kpis.cashAmount).toBe(7150);
      expect(json.data.kpis.digitalAmount).toBe(5300);
      expect(json.data.kpis.expenseAmount).toBe(1200);
      expect(json.data.activeDrawerSession?.id).toBe("session-1");
    });
  });

  describe("GET /api/desktop/v1/cashier/payable-orders", () => {
    it("separates pending orders from paid and closed orders", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payable-orders");
      const res = await getPayableOrders(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.pendingQueue).toHaveLength(1);
      expect(json.data.pendingQueue[0].orderNumber).toBe("BKG-1045");
      expect(json.data.pendingQueue[0].remainingBalance).toBe(500);

      expect(json.data.paidAndClosed).toHaveLength(1);
      expect(json.data.paidAndClosed[0].orderNumber).toBe("BKG-1037");
      expect(json.data.paidAndClosed[0].remainingBalance).toBe(0);
    });
  });

  describe("GET /api/desktop/v1/cashier/ledger", () => {
    it("passes search filters and returns paginated records", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/ledger?search=Maria&page=1&pageSize=15");
      const res = await getLedger(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.records).toHaveLength(1);
      expect(json.data.kpis.netFlow).toBe(11250);
      expect(mockedQueries).toHaveBeenCalledWith(
        "branch-uuid-1",
        "Main Spa",
        "2026-10-23",
        expect.objectContaining({ search: "Maria", page: 1, pageSize: 15 }),
        expect.anything()
      );
    });
  });

  describe("GET /api/desktop/v1/cashier/drawers & POST session actions", () => {
    it("returns drawer sessions and accounts", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers");
      const res = await getDrawers(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.activeSessions).toHaveLength(1);
      expect(json.data.accounts).toHaveLength(2);
    });

    it("calls open_cash_session_atomic on open action", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { ok: true, sessionId: "sess-99" },
        error: null,
      });
      const client = createMockClient({ rpc: mockRpc });
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "open",
          cashDrawerAccountId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          openingFloat: 2000,
          openingNote: "Starting float",
          idempotencyKey: "idem-open-1",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("open_cash_session_atomic", {
        p_branch_id: "branch-uuid-1",
        p_cash_drawer_account_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        p_opening_float: 2000,
        p_business_date: "2026-10-23",
        p_opening_note: "Starting float",
        p_idempotency_key: "idem-open-1",
      });
    });

    it("calls close_cash_session_atomic on close action", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { ok: true, sessionId: "sess-1" },
        error: null,
      });
      const client = createMockClient({ rpc: mockRpc });
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "close",
          sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          countedCash: 2500,
          closingNote: "Balanced",
          idempotencyKey: "idem-close-1",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("close_cash_session_atomic", {
        p_session_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        p_counted_cash: 2500,
        p_closing_note: "Balanced",
        p_idempotency_key: "idem-close-1",
      });
    });
  });

  describe("GET /api/desktop/v1/cashier/day-close", () => {
    it("returns dayClose with isFinalizationSupported: false explicitly preserved", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/day-close");
      const res = await getDayClose(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.isFinalizationSupported).toBe(false);
      expect(json.data.reconciliationStatus).toBe("draft");
      expect(json.data.expectedCash).toBe(2500);
    });
  });

  describe("POST /api/desktop/v1/cashier/payments", () => {
    it("validates payment method compatibility and posts payment atomically", async () => {
      const client = {
        from: vi.fn((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "branch-uuid-1", name: "Main Spa" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "booking_orders") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "11111111-1111-4111-a111-111111111111", branch_id: "branch-uuid-1" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "financial_accounts") {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "22222222-2222-4222-a222-222222222222",
                      account_type: "cash_drawer",
                      branch_id: "branch-uuid-1",
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      };

      mockAuthSuccess(client);
      mockedPaymentWriter.mockResolvedValueOnce({
        ok: true,
        data: {
          success: true,
          isIdempotentReplay: false,
          transactionId: "tx-pay-1",
          orderId: "11111111-1111-4111-a111-111111111111",
          branchId: "branch-uuid-1",
          businessDate: "2026-10-23",
          totalPaid: 500,
          totalPayable: 500,
          netAllocated: 500,
          remainingBalance: 0,
          paymentState: "paid",
          movements: [],
          allocations: [],
        },
      });

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payments", {
        method: "POST",
        body: JSON.stringify({
          orderId: "11111111-1111-4111-a111-111111111111",
          idempotencyKey: "idem-pay-1",
          payments: [
            {
              amount: 500,
              paymentMethod: "cash",
              financialAccountId: "22222222-2222-4222-a222-222222222222",
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.remainingBalance).toBe(0);
      expect(json.data.paymentState).toBe("paid");
    });

    it("rejects payments for cross-branch orders with 403", async () => {
      const client = {
        from: vi.fn((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "branch-uuid-1", name: "Main Spa" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "booking_orders") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "11111111-1111-4111-a111-111111111111", branch_id: "other-branch-uuid" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payments", {
        method: "POST",
        body: JSON.stringify({
          orderId: "11111111-1111-4111-a111-111111111111",
          idempotencyKey: "idem-pay-2",
          payments: [
            {
              amount: 500,
              paymentMethod: "cash",
              financialAccountId: "22222222-2222-4222-a222-222222222222",
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("BRANCH_MISMATCH");
    });
  });

  describe("POST /api/desktop/v1/cashier/expenses", () => {
    it("validates and posts an expense atomically", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { ok: true, transactionId: "tx-exp-1" },
        error: null,
      });

      const client = {
        from: vi.fn((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "branch-uuid-1", name: "Main Spa" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "financial_accounts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "22222222-2222-4222-a222-222222222222",
                      branch_id: "branch-uuid-1",
                      is_active: true,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: mockRpc,
      };

      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: "11111111-1111-4111-a111-111111111111",
          financialAccountId: "22222222-2222-4222-a222-222222222222",
          amount: 350,
          payee: "Direct Vendor",
          description: "Nail products",
          idempotencyKey: "idem-exp-1",
        }),
      });

      const res = await postExpense(req);
            expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("post_expense_atomic", expect.objectContaining({
        p_branch_id: "branch-uuid-1",
        p_amount: 350,
        p_description: "Nail products",
        p_idempotency_key: "idem-exp-1",
      }));
    });
  });
});
