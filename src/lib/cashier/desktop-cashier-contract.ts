import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth, type DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";

import type {
  CashFlowWorkspaceData,
  PayableOrderOption,
  LedgerRecordItem,
  LedgerKpiSummary,
  DayCloseSummaryData,
  HistoryTabSummary,
  CashSessionSummary,
  MaskedAccountOption,
  ExpenseCategoryOption,
  StaffOption,
} from "@/lib/cash-flow/cash-flow-types";
import { logError } from "@/lib/logger";

export function desktopJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function desktopFailure(code: string, message: string, status = 400) {
  return desktopJson({ ok: false, code, message }, status);
}

export interface GenericRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export interface DynamicCategoryClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        maybeSingle: () => Promise<{ data: { id: string; is_active?: boolean } | null; error: { message: string } | null }>;
      };
    };
  };
}

export interface DesktopCashierContext {
  supabase: Extract<DesktopBearerAuthResult, { ok: true }>["client"];
  operator: InhouseBookingOperator;
  authUserId: string;
  branchId: string;
  branchName: string;
  businessDate: string;
}

export async function withDesktopCashierContext(
  request: Request,
  run: (ctx: DesktopCashierContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await verifyDesktopBearerAuth(request);
    if (!auth.ok) {
      return desktopFailure(auth.code, auth.message, auth.status);
    }
    const staff = auth.operator.staff;
    if (!staff?.branch_id || !auth.operator.staffRole) {
      return desktopFailure(
        "STAFF_NOT_FOUND",
        "An active staff profile with a branch is required.",
        403
      );
    }

    const branch = await auth.client
      .from("branches")
      .select("id, name")
      .eq("id", staff.branch_id)
      .maybeSingle();

    if (branch.error || !branch.data) {
      return desktopFailure(
        "BRANCH_NOT_FOUND",
        "The authenticated branch is unavailable.",
        403
      );
    }

    const businessDate = getBranchBusinessDate();

    return await run({
      supabase: auth.client,
      operator: auth.operator,
      authUserId: auth.user.id,
      branchId: staff.branch_id,
      branchName: branch.data.name,
      businessDate,
    });
  } catch (error) {
    logError("api.desktop.cashier_contract.failed", { error });
    return desktopFailure(
      "SERVER_ERROR",
      "The request could not be completed. Please refresh and try again.",
      500
    );
  }
}

// ── Overview Data ────────────────────────────────────────────────────────────

export interface DesktopCashierOverviewKpis {
  totalCollected: number;
  totalTransactions: number;
  pendingAmount: number;
  pendingBookingsCount: number;
  cashAmount: number;
  cashCount: number;
  digitalAmount: number;
  digitalCount: number;
  expenseAmount: number;
  expenseCount: number;
}

export interface DesktopCashierOverviewData {
  branchId: string;
  branchName: string;
  businessDate: string;
  kpis: DesktopCashierOverviewKpis;
  paymentMix: CashFlowWorkspaceData["today"]["paymentMix"];
  recentPayments: CashFlowWorkspaceData["today"]["recentPayments"];
  coverage: CashFlowWorkspaceData["today"]["coverage"];
  activeDrawerSession: CashSessionSummary | null;
}

export async function getDesktopCashierOverview(
  ctx: DesktopCashierContext
): Promise<DesktopCashierOverviewData> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    {},
    ctx.supabase
  );

  let cashAmount = 0;
  let cashCount = 0;
  let digitalAmount = 0;
  let digitalCount = 0;

  for (const mix of data.today.paymentMix) {
    if (mix.method === "cash") {
      cashAmount += mix.amount;
      cashCount += mix.transactionCount;
    } else {
      digitalAmount += mix.amount;
      digitalCount += mix.transactionCount;
    }
  }

  const activeDrawerSession =
    data.cashSessions?.activeSessions && data.cashSessions.activeSessions.length > 0
      ? data.cashSessions.activeSessions[0]
      : null;

  // Count actual recorded operational expenses for this business date
  let expenseCount = 0;
  try {
    const { count } = await (ctx.supabase as unknown as {
      from: (t: string) => {
        select: (c: string, o: { count: string; head: boolean }) => {
          eq: (k: string, v: unknown) => {
            eq: (k: string, v: unknown) => {
              eq: (k: string, v: unknown) => {
                eq: (k: string, v: unknown) => Promise<{ count: number | null; error: unknown }>;
              };
            };
          };
        };
      };
    })
      .from("financial_transactions")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", ctx.branchId)
      .eq("business_date", ctx.businessDate)
      .eq("transaction_type", "operational_expense")
      .eq("status", "posted");

    if (typeof count === "number") {
      expenseCount = count;
    } else {
      expenseCount = data.ledger.records.filter(
        (r) =>
          r.category.toLowerCase().includes("expense") ||
          (r.outflow !== null && r.outflow > 0 && !r.isReconciliationOnly)
      ).length;
    }
  } catch {
    expenseCount = data.ledger.records.filter(
      (r) =>
        r.category.toLowerCase().includes("expense") ||
        (r.outflow !== null && r.outflow > 0 && !r.isReconciliationOnly)
    ).length;
  }

  // Derive pending balances from authoritative payable orders
  const pendingOrders = (data.payableOrders || []).filter(
    (o) => o.remainingBalance > 0
  );
  const pendingAmount = pendingOrders.reduce(
    (sum, o) => sum + (o.remainingBalance > 0 ? o.remainingBalance : 0),
    0
  );
  const pendingBookingsCount = pendingOrders.length;
  const totalTransactions = cashCount + digitalCount;

  return {
    branchId: ctx.branchId,
    branchName: ctx.branchName,
    businessDate: ctx.businessDate,
    kpis: {
      totalCollected: data.today.kpis.recordedPayments,
      totalTransactions,
      pendingAmount,
      pendingBookingsCount,
      cashAmount,
      cashCount,
      digitalAmount,
      digitalCount,
      expenseAmount: data.dayClose.recordedOutflow,
      expenseCount,
    },
    paymentMix: data.today.paymentMix,
    recentPayments: data.today.recentPayments,
    coverage: data.today.coverage,
    activeDrawerSession: activeDrawerSession ?? null,
  };
}

// ── Payable Orders Data ──────────────────────────────────────────────────────

export interface DesktopPayableOrdersData {
  pendingQueue: PayableOrderOption[];
  paidAndClosed: PayableOrderOption[];
  accounts: MaskedAccountOption[];
  paymentMethods: string[];
}

export async function getDesktopPayableOrders(
  ctx: DesktopCashierContext
): Promise<DesktopPayableOrdersData> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    {},
    ctx.supabase
  );

  const pendingQueue: PayableOrderOption[] = [];
  const paidAndClosed: PayableOrderOption[] = [];

  for (const order of data.payableOrders) {
    const isFullySettled = order.remainingBalance <= 0;
    const isServicesComplete =
      order.bookingStatus?.toLowerCase() === "completed";

    // Paid & Closed requires BOTH full settlement and completed services
    if (isFullySettled && isServicesComplete) {
      paidAndClosed.push(order);
    } else {
      pendingQueue.push(order);
    }
  }

  return {
    pendingQueue,
    paidAndClosed,
    accounts: data.accounts,
    paymentMethods: ["cash", "gcash", "maya", "card", "bank_transfer"],
  };
}

// ── Ledger Data ──────────────────────────────────────────────────────────────

export interface DesktopLedgerData {
  kpis: LedgerKpiSummary;
  records: LedgerRecordItem[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
  accounts: MaskedAccountOption[];
}

export async function getDesktopLedger(
  ctx: DesktopCashierContext,
  filters: {
    search?: string;
    category?: string;
    method?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<DesktopLedgerData> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    filters,
    ctx.supabase
  );

  return {
    kpis: data.ledger.kpis,
    records: data.ledger.records,
    totalRecords: data.ledger.totalRecords,
    page: data.ledger.page,
    pageSize: data.ledger.pageSize,
    totalPages: data.ledger.totalPages,
    accounts: data.accounts,
  };
}

// ── Cash Drawers Data ────────────────────────────────────────────────────────

export interface DesktopDrawersData {
  activeSessions: CashSessionSummary[];
  availableDrawers: MaskedAccountOption[];
  accounts: MaskedAccountOption[];
  expenseCategories: ExpenseCategoryOption[];
  staffOptions: StaffOption[];
}

export async function getDesktopDrawers(
  ctx: DesktopCashierContext
): Promise<DesktopDrawersData> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    {},
    ctx.supabase
  );

  return {
    activeSessions: data.cashSessions?.activeSessions ?? [],
    availableDrawers: data.cashSessions?.availableDrawers ?? [],
    accounts: data.accounts,
    expenseCategories: data.expenseCategories ?? [],
    staffOptions: data.staffOptions ?? [],
  };
}

// ── Day Close Data ───────────────────────────────────────────────────────────

export async function getDesktopDayClose(
  ctx: DesktopCashierContext
): Promise<DayCloseSummaryData> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    {},
    ctx.supabase
  );

  return {
    ...data.dayClose,
    isFinalizationSupported: false,
  };
}

// ── History Data ─────────────────────────────────────────────────────────────

export async function getDesktopHistory(
  ctx: DesktopCashierContext
): Promise<HistoryTabSummary> {
  const data = await getCashFlowData(
    ctx.branchId,
    ctx.branchName,
    ctx.businessDate,
    {},
    ctx.supabase
  );

  return data.history;
}

// ── Mutations ────────────────────────────────────────────────────────────────

export const DesktopExpensePayloadSchema = z.object({
  categoryId: z.string().uuid("Category ID must be a valid UUID"),
  financialAccountId: z.string().uuid("Financial account ID must be a valid UUID"),
  amount: z.number().positive("Expense amount must be greater than zero"),
  payee: z.string().trim().min(1, "Payee is required").max(255),
  description: z.string().trim().min(1, "Description is required").max(500),
  receiptReference: z.string().trim().max(255).nullish(),
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Business date must be YYYY-MM-DD")
    .optional(),
  notes: z.string().trim().max(1000).nullish(),
  idempotencyKey: z.string().trim().min(1).max(255),
});

export type DesktopExpensePayload = z.infer<typeof DesktopExpensePayloadSchema>;

export const DesktopDrawerSessionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    cashDrawerAccountId: z.string().uuid("Cash drawer account ID must be a valid UUID"),
    openingFloat: z.number().min(0, "Opening float cannot be negative"),
    openingNote: z.string().trim().max(500).nullish(),
    idempotencyKey: z.string().trim().min(1).max(255),
  }),
  z.object({
    action: z.literal("handover"),
    sessionId: z.string().uuid("Session ID must be a valid UUID"),
    incomingCustodianId: z.string().uuid("Incoming custodian ID must be a valid UUID"),
    countedCash: z.number().min(0, "Counted cash cannot be negative"),
    notes: z.string().trim().max(500).nullish(),
    idempotencyKey: z.string().trim().min(1).max(255),
  }),
  z.object({
    action: z.literal("close"),
    sessionId: z.string().uuid("Session ID must be a valid UUID"),
    countedCash: z.number().min(0, "Counted cash cannot be negative"),
    closingNote: z.string().trim().max(500).nullish(),
    idempotencyKey: z.string().trim().min(1).max(255),
  }),
  z.object({
    action: z.literal("adjustment"),
    cashDrawerId: z.string().uuid("Cash drawer ID must be a valid UUID"),
    entryType: z.enum(["cash_addition", "cash_removal"]),
    amount: z.number().positive("Adjustment amount must be greater than zero"),
    adjustmentReason: z.string().trim().min(1, "Adjustment reason is required").max(500),
    notes: z.string().trim().max(500).nullish(),
    idempotencyKey: z.string().trim().min(1).max(255),
  }),
]);

export type DesktopDrawerSessionAction = z.infer<
  typeof DesktopDrawerSessionActionSchema
>;
