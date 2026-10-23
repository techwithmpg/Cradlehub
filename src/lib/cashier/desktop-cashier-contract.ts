import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import { recordOrderPayment } from "@/lib/cash-flow/payment-writer";
import {
  PostOrderPaymentPayloadSchema,
  type PostOrderPaymentPayload,
  isPaymentMethodCompatibleWithAccount,
  FinancialPaymentMethodSchema,
} from "@/lib/cash-flow/financial-contract";
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

export interface DesktopCashierContext {
  supabase: any;
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

  return {
    branchId: ctx.branchId,
    branchName: ctx.branchName,
    businessDate: ctx.businessDate,
    kpis: {
      totalCollected: data.today.kpis.recordedPayments,
      totalTransactions: data.today.kpis.paidBookingsCount,
      pendingAmount: data.today.kpis.outstandingBalance,
      pendingBookingsCount: data.today.kpis.needsPaymentCount,
      cashAmount,
      cashCount,
      digitalAmount,
      digitalCount,
      expenseAmount: data.dayClose.recordedOutflow,
      expenseCount: data.dayClose.coverageCategories.length,
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
    if (order.remainingBalance > 0 && order.paymentStatus !== "paid") {
      pendingQueue.push(order);
    } else {
      paidAndClosed.push(order);
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

  return data.dayClose;
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
