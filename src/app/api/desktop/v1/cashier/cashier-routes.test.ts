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

vi.mock("@/lib/cash-flow/legacy-payment-writer", () => ({
  recordLegacyBookingPaymentDomain: vi.fn(),
}));

vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: vi.fn(() => "2026-10-23"),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { recordOrderPayment } from "@/lib/cash-flow/payment-writer";
import { recordLegacyBookingPaymentDomain } from "@/lib/cash-flow/legacy-payment-writer";
import { GET as getOverview } from "./overview/route";
import { GET as getPayableOrders } from "./payable-orders/route";
import { GET as getLedger } from "./ledger/route";
import { GET as getDrawers, POST as postDrawerAction } from "./drawers/route";
import { GET as getDayClose } from "./day-close/route";
import { POST as postPayment } from "./payments/route";
import { POST as postExpense } from "./expenses/route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedQueries = vi.mocked(getCashFlowData);
const mockedPaymentWriter = vi.mocked(recordOrderPayment);
const mockedLegacyPaymentDomain = vi.mocked(recordLegacyBookingPaymentDomain);

const UUID_DRAWER = "22222222-2222-4222-a222-222222222222";
const UUID_GCASH = "33333333-3333-4333-a333-333333333333";
const UUID_CATEGORY = "44444444-4444-4444-a444-444444444444";
const UUID_CUSTODIAN = "55555555-5555-4555-a555-555555555555";
const UUID_SESSION = "66666666-6666-4666-a666-666666666666";

interface MockClientOptions {
  branchId?: string;
  orderId?: string | null;
  orderBranchId?: string;
  accounts?: Array<{
    id: string;
    account_type: string;
    branch_id: string | null;
    is_active: boolean;
  }>;
  category?: { id: string; is_active: boolean } | null;
  custodian?: { id: string; branch_id: string | null; is_active: boolean } | null;
  rpcResult?: { data: unknown; error: unknown };
  transactionsCount?: number;
}

function createRobustMockClient(opts: MockClientOptions = {}) {
  const branchId = opts.branchId ?? "branch-uuid-1";
  const defaultAccounts = opts.accounts ?? [
    {
      id: UUID_DRAWER,
      account_type: "cash_drawer",
      branch_id: branchId,
      is_active: true,
    },
    {
      id: UUID_GCASH,
      account_type: "gcash",
      branch_id: branchId,
      is_active: true,
    },
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === "branches") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: branchId, name: "Main Spa" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "financial_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: defaultAccounts.find((a) => a.id === val) ?? null,
                error: null,
              }),
            })),
            in: vi.fn((col: string, ids: string[]) =>
              Promise.resolve({
                data: defaultAccounts.filter((a) => ids.includes(a.id)),
                error: null,
              })
            ),
          }),
        };
      }
      if (table === "financial_expense_categories") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  opts.category !== undefined
                    ? opts.category
                    : { id: val, is_active: true },
                error: null,
              }),
            })),
          }),
        };
      }
      if (table === "staff") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  opts.custodian !== undefined
                    ? opts.custodian
                    : { id: val, branch_id: branchId, is_active: true },
                error: null,
              }),
            })),
          }),
        };
      }
      if (table === "booking_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  opts.orderBranchId !== undefined
                    ? { id: val, branch_id: opts.orderBranchId }
                    : opts.orderId === null
                    ? null
                    : { id: val, branch_id: branchId },
                error: null,
              }),
            })),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: val,
                  branch_id: branchId,
                  order_id: null,
                  amount_paid: 200,
                  payment_status: "pending",
                  status: "confirmed",
                  metadata: { total_price: 500 },
                },
                error: null,
              }),
            })),
          }),
        };
      }
      if (table === "financial_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    count: opts.transactionsCount ?? 2,
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue(
      opts.rpcResult ?? {
        data: { ok: true, success: true, transactionId: "tx-123", sessionId: UUID_SESSION },
        error: null,
      }
    ),
  };
}

function mockAuthSuccess(client?: unknown, role = "crm") {
  mockedAuth.mockResolvedValue({
    ok: true as const,
    operator: {
      authUserId: "auth-user-1",
      staff: {
        id: "staff-1",
        branch_id: "branch-uuid-1",
        system_role: role,
      },
      staffRole: role,
      isDevBypass: false,
    },
    user: { id: "auth-user-1", email: "cashier@cradlehub.test" },
    client: (client ?? createRobustMockClient()) as unknown as SupabaseClient<Database>,
  });
}

const mockWorkspaceData: CashFlowWorkspaceData = {
  branchId: "branch-uuid-1",
  branchName: "Main Spa",
  businessDate: "2026-10-23",
  accounts: [
    {
      id: UUID_DRAWER,
      name: "Main Cash Drawer",
      accountType: "cash_drawer",
      identifierMask: "CASH-01",
      branchId: "branch-uuid-1",
    },
    {
      id: UUID_GCASH,
      name: "Front Desk GCash",
      accountType: "gcash",
      identifierMask: "0917****123",
      branchId: "branch-uuid-1",
    },
  ],
  expenseCategories: [
    { id: UUID_CATEGORY, code: "supplies", name: "Supplies", description: "Consumables" },
  ],
  staffOptions: [
    { id: "staff-1", name: "Maria Santos", role: "crm" },
    { id: "staff-2", name: "Anna Reyes", role: "therapist" },
  ],
  cashSessions: {
    activeSessions: [
      {
        id: UUID_SESSION,
        branchId: "branch-uuid-1",
        businessDate: "2026-10-23",
        cashDrawerAccountId: UUID_DRAWER,
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
        id: UUID_DRAWER,
        name: "Main Cash Drawer",
        accountType: "cash_drawer",
        identifierMask: "CASH-01",
        branchId: "branch-uuid-1",
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
  operationalExpenses: {
    totalAmount: 1850,
    count: 3,
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
      bookingStatus: "confirmed",
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
      bookingStatus: "completed",
      paymentStatus: "paid",
    },
    {
      id: "order-3",
      sourceKind: "booking_order",
      paymentEligible: true,
      orderNumber: "BKG-1038",
      customerName: "Carla Lim",
      serviceDescription: "Foot Spa",
      totalAmount: 800,
      amountPaid: 400,
      remainingBalance: 400,
      bookingDate: "2026-10-23",
      bookingStatus: "in_progress",
      paymentStatus: "partially_paid",
    },
    {
      id: "order-4",
      sourceKind: "booking_order",
      paymentEligible: false,
      orderNumber: "BKG-1039",
      customerName: "Ana Reyes",
      serviceDescription: "Massage",
      totalAmount: 600,
      amountPaid: 600,
      remainingBalance: 0,
      bookingDate: "2026-10-23",
      bookingStatus: "in_progress",
      paymentStatus: "paid",
    },
    {
      id: "order-5",
      sourceKind: "booking_order",
      paymentEligible: false,
      orderNumber: "BKG-1040",
      customerName: "Elena Cruz",
      serviceDescription: "Facial",
      totalAmount: 400,
      amountPaid: 0,
      remainingBalance: 0,
      bookingDate: "2026-10-23",
      bookingStatus: "cancelled",
      paymentStatus: "unpaid",
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
        client: createRobustMockClient() as unknown as SupabaseClient<Database>,
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
      const client = createRobustMockClient({ transactionsCount: 3 });
      mockAuthSuccess(client);
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/overview");
      const res = await getOverview(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.branchName).toBe("Main Spa");
      expect(json.data.businessDate).toBe("2026-10-23");
      expect(json.data.kpis.totalCollected).toBe(12450);
      expect(json.data.kpis.totalTransactions).toBe(18);
      expect(json.data.kpis.pendingAmount).toBe(900);
      expect(json.data.kpis.pendingBookingsCount).toBe(2);
      expect(json.data.kpis.cashAmount).toBe(7150);
      expect(json.data.kpis.cashCount).toBe(10);
      expect(json.data.kpis.digitalAmount).toBe(5300);
      expect(json.data.kpis.digitalCount).toBe(8);
      expect(json.data.kpis.expenseCount).toBe(3);
      expect(json.data.kpis.expenseAmount).toBe(1850);
      expect(json.data.activeDrawerSession?.cashDrawerName).toBe("Main Cash Drawer");
    });
  });

  describe("GET /api/desktop/v1/cashier/payable-orders", () => {
    it("separates pending orders from paid and closed orders strictly", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payable-orders");
      const res = await getPayableOrders(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.pendingQueue).toHaveLength(2);
      expect(json.data.pendingQueue[0].orderNumber).toBe("BKG-1045");
      expect(json.data.pendingQueue[1].orderNumber).toBe("BKG-1038");

      expect(json.data.paidAndClosed).toHaveLength(1);
      expect(json.data.paidAndClosed[0].orderNumber).toBe("BKG-1037");
    });
  });

  describe("GET /api/desktop/v1/cashier/ledger", () => {
    it("passes search filters and returns paginated records", async () => {
      mockAuthSuccess();
      mockedQueries.mockResolvedValueOnce(mockWorkspaceData);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/ledger?search=Maria&page=1&pageSize=10");
      const res = await getLedger(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.data.records).toHaveLength(1);
      expect(json.data.totalRecords).toBe(1);
      expect(json.data.page).toBe(1);
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
      expect(json.data.availableDrawers).toHaveLength(1);
    });

    it("enforces role authorization on drawer operations", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client, "therapist");

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "open",
          cashDrawerAccountId: UUID_DRAWER,
          openingFloat: 2000,
          idempotencyKey: "idem-unauth-1",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHORIZED_ROLE");
    });

    it("calls open_cash_session_atomic on open action after verifying drawer account", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "open",
          cashDrawerAccountId: UUID_DRAWER,
          openingFloat: 2000,
          openingNote: "Shift start",
          idempotencyKey: "idem-open-1",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(200);
      expect(client.rpc).toHaveBeenCalledWith("open_cash_session_atomic", {
        p_branch_id: "branch-uuid-1",
        p_cash_drawer_account_id: UUID_DRAWER,
        p_opening_float: 2000,
        p_business_date: "2026-10-23",
        p_opening_note: "Shift start",
        p_idempotency_key: "idem-open-1",
      });
    });

    it("calls close_cash_session_atomic on close action", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "close",
          sessionId: UUID_SESSION,
          countedCash: 2500,
          closingNote: "Balanced",
          idempotencyKey: "idem-close-1",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(200);
      expect(client.rpc).toHaveBeenCalledWith("close_cash_session_atomic", {
        p_session_id: UUID_SESSION,
        p_counted_cash: 2500,
        p_closing_note: "Balanced",
        p_idempotency_key: "idem-close-1",
      });
    });

    it("rejects drawer handover if incoming custodian belongs to another branch", async () => {
      const client = createRobustMockClient({
        custodian: { id: UUID_CUSTODIAN, branch_id: "different-branch-uuid", is_active: true },
      });
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/drawers", {
        method: "POST",
        body: JSON.stringify({
          action: "handover",
          sessionId: UUID_SESSION,
          incomingCustodianId: UUID_CUSTODIAN,
          countedCash: 2500,
          idempotencyKey: "idem-handover-err",
        }),
      });

      const res = await postDrawerAction(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("INVALID_CUSTODIAN");
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
      const client = createRobustMockClient();
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
              financialAccountId: UUID_DRAWER,
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

    it("rejects payments when RPC posting returns unsuccessful result", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client);

      mockedPaymentWriter.mockResolvedValueOnce({
        ok: false,
        error: "Business validation failed in RPC.",
        code: "PAYMENT_REJECTED",
      });

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payments", {
        method: "POST",
        body: JSON.stringify({
          orderId: "11111111-1111-4111-a111-111111111111",
          idempotencyKey: "idem-pay-fail",
          payments: [
            {
              amount: 500,
              paymentMethod: "cash",
              financialAccountId: UUID_DRAWER,
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("PAYMENT_REJECTED");
    });

    it("rejects payments for cross-branch orders with 403", async () => {
      const client = createRobustMockClient({
        orderBranchId: "other-branch-uuid",
      });
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
              financialAccountId: UUID_DRAWER,
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("BRANCH_MISMATCH");
    });

    it("rejects payment recording when operator has an unauthorized role", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client, "therapist");

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payments", {
        method: "POST",
        body: JSON.stringify({
          orderId: "11111111-1111-4111-a111-111111111111",
          idempotencyKey: "idem-unauth-role",
          payments: [
            {
              amount: 500,
              paymentMethod: "cash",
              financialAccountId: UUID_DRAWER,
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
    });

    it("supports legacy booking payment when orderId references a legacy booking row", async () => {
      const client = createRobustMockClient({ orderId: null });
      mockAuthSuccess(client);

      mockedLegacyPaymentDomain.mockResolvedValueOnce({
        ok: true,
        data: {
          success: true,
          transactionId: "tx-legacy-1",
          paymentDelta: 300,
          isIdempotentReplay: false,
          branchId: "branch-uuid-1",
        },
      });

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/payments", {
        method: "POST",
        body: JSON.stringify({
          orderId: "11111111-1111-4111-a111-111111111111",
          idempotencyKey: "idem-legacy-1",
          payments: [
            {
              amount: 300,
              paymentMethod: "cash",
              financialAccountId: UUID_DRAWER,
            },
          ],
        }),
      });

      const res = await postPayment(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.success).toBe(true);
      expect(json.data.transactionId).toBe("tx-legacy-1");
    });
  });

  describe("POST /api/desktop/v1/cashier/expenses", () => {
    it("validates category and account eligibility and posts expense atomically", async () => {
      const client = createRobustMockClient();
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: UUID_CATEGORY,
          financialAccountId: UUID_DRAWER,
          amount: 150,
          payee: "Ace Hardware",
          description: "Cleaning supplies",
          idempotencyKey: "idem-exp-1",
        }),
      });

      const res = await postExpense(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(client.rpc).toHaveBeenCalledWith("post_expense_atomic", expect.objectContaining({
        p_branch_id: "branch-uuid-1",
        p_amount: 150,
        p_category_id: UUID_CATEGORY,
        p_financial_account_id: UUID_DRAWER,
        p_payee: "Ace Hardware",
        p_description: "Cleaning supplies",
        p_idempotency_key: "idem-exp-1",
      }));
    });

    it("rejects expense when category is inactive or invalid", async () => {
      const client = createRobustMockClient({ category: null });
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: UUID_CATEGORY,
          financialAccountId: UUID_DRAWER,
          amount: 150,
          payee: "Vendor",
          description: "Items",
          idempotencyKey: "idem-cat-err",
        }),
      });

      const res = await postExpense(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("CATEGORY_INVALID");
    });

    it("rejects expense when RPC reports unsuccessful business outcome", async () => {
      const client = createRobustMockClient({
        rpcResult: { data: { success: false, error: "Insufficient drawer float for expense." }, error: null },
      });
      mockAuthSuccess(client);

      const req = new NextRequest("http://localhost/api/desktop/v1/cashier/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: UUID_CATEGORY,
          financialAccountId: UUID_DRAWER,
          amount: 50000,
          payee: "Vendor",
          description: "Big purchase",
          idempotencyKey: "idem-exp-fail",
        }),
      });

      const res = await postExpense(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("EXPENSE_REJECTED");
    });
  });
});
