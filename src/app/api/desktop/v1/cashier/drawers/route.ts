import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  getDesktopDrawers,
  DesktopDrawerSessionActionSchema,
  desktopJson,
  desktopFailure,
  type GenericRpcClient,
} from "@/lib/cashier/desktop-cashier-contract";

export async function GET(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    const data = await getDesktopDrawers(ctx);
    return desktopJson({
      ok: true,
      data,
    });
  });
}

export async function POST(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    // Enforce role authorization: only manager, assistant_manager, store_manager, owner, crm can perform drawer operations
    const allowedRoles = ["owner", "manager", "assistant_manager", "store_manager", "crm"];
    if (!allowedRoles.includes(ctx.operator.staffRole ?? "")) {
      return desktopFailure("UNAUTHORIZED_ROLE", "Caller does not have permission for cash drawer operations.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return desktopFailure("INVALID_JSON", "Invalid JSON in request body.", 400);
    }

    const parsed = DesktopDrawerSessionActionSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join("; ");
      return desktopFailure("VALIDATION_ERROR", errorMsg, 400);
    }

    const action = parsed.data;

    if (action.action === "open") {
      // Verify cash drawer account ownership and branch
      const { data: drawerAccount, error: drawerError } = await ctx.supabase
        .from("financial_accounts")
        .select("id, branch_id, is_active, account_type")
        .eq("id", action.cashDrawerAccountId)
        .maybeSingle();

      if (drawerError || !drawerAccount) {
        return desktopFailure("ACCOUNT_NOT_FOUND", "Cash drawer account was not found.", 404);
      }
      if (!drawerAccount.is_active) {
        return desktopFailure("ACCOUNT_INACTIVE", "Cash drawer account is inactive.", 400);
      }
      if (drawerAccount.account_type !== "cash_drawer") {
        return desktopFailure("ACCOUNT_INCOMPATIBLE", "Account is not a cash drawer.", 400);
      }
      if (drawerAccount.branch_id && drawerAccount.branch_id !== ctx.branchId) {
        return desktopFailure("ACCOUNT_WRONG_BRANCH", "Cash drawer does not belong to active branch.", 403);
      }

      const { data, error } = await (ctx.supabase as unknown as GenericRpcClient).rpc("open_cash_session_atomic", {
        p_branch_id: ctx.branchId,
        p_cash_drawer_account_id: action.cashDrawerAccountId,
        p_opening_float: action.openingFloat,
        p_business_date: ctx.businessDate,
        p_opening_note: action.openingNote ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      if (!data || (typeof data === "object" && ("ok" in data && (data as Record<string, unknown>).ok === false))) {
        return desktopFailure("RPC_FAILED", "Failed to open cash drawer session.", 400);
      }
      return desktopJson({ ok: true, data });
    }

    if (action.action === "handover") {
      // Verify incoming custodian is an active staff in the same branch
      const { data: custodian, error: custError } = await ctx.supabase
        .from("staff")
        .select("id, branch_id, is_active")
        .eq("id", action.incomingCustodianId)
        .maybeSingle();

      if (custError || !custorCustodianValid(custodian, ctx.branchId)) {
        return desktopFailure("INVALID_CUSTODIAN", "Incoming custodian must be an active staff member in this branch.", 400);
      }

      const { data, error } = await (ctx.supabase as unknown as GenericRpcClient).rpc("handover_cash_session_atomic", {
        p_session_id: action.sessionId,
        p_incoming_custodian_id: action.incomingCustodianId,
        p_counted_cash: action.countedCash,
        p_notes: action.notes ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      if (!data || (typeof data === "object" && ("ok" in data && (data as Record<string, unknown>).ok === false))) {
        return desktopFailure("RPC_FAILED", "Failed to handover cash session.", 400);
      }
      return desktopJson({ ok: true, data });
    }

    if (action.action === "close") {
      const { data, error } = await (ctx.supabase as unknown as GenericRpcClient).rpc("close_cash_session_atomic", {
        p_session_id: action.sessionId,
        p_counted_cash: action.countedCash,
        p_closing_note: action.closingNote ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      if (!data || (typeof data === "object" && ("ok" in data && (data as Record<string, unknown>).ok === false))) {
        return desktopFailure("RPC_FAILED", "Failed to close cash session.", 400);
      }
      return desktopJson({ ok: true, data });
    }

    if (action.action === "adjustment") {
      // Verify cash drawer account ownership
      const { data: drawerAccount, error: drawerError } = await ctx.supabase
        .from("financial_accounts")
        .select("id, branch_id, is_active, account_type")
        .eq("id", action.cashDrawerId)
        .maybeSingle();

      if (drawerError || !drawerAccount) {
        return desktopFailure("ACCOUNT_NOT_FOUND", "Cash drawer account was not found.", 404);
      }
      if (!drawerAccount.is_active) {
        return desktopFailure("ACCOUNT_INACTIVE", "Cash drawer account is inactive.", 400);
      }
      if (drawerAccount.account_type !== "cash_drawer") {
        return desktopFailure("ACCOUNT_INCOMPATIBLE", "Account is not a cash drawer.", 400);
      }
      if (drawerAccount.branch_id && drawerAccount.branch_id !== ctx.branchId) {
        return desktopFailure("ACCOUNT_WRONG_BRANCH", "Cash drawer does not belong to active branch.", 403);
      }

      const { data, error } = await (ctx.supabase as unknown as GenericRpcClient).rpc("post_cash_adjustment_atomic", {
        p_branch_id: ctx.branchId,
        p_financial_account_id: action.cashDrawerId,
        p_adjustment_type: action.entryType === "cash_addition" ? "addition" : "removal",
        p_amount: action.amount,
        p_reason: action.adjustmentReason,
        p_business_date: ctx.businessDate,
        p_notes: action.notes ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      if (!data || (typeof data === "object" && ("ok" in data && (data as Record<string, unknown>).ok === false))) {
        return desktopFailure("RPC_FAILED", "Failed to record cash adjustment.", 400);
      }
      return desktopJson({ ok: true, data });
    }

    return desktopFailure("UNKNOWN_ACTION", "Unsupported drawer operation.", 400);
  });
}

function custorCustodianValid(
  custodian: Record<string, unknown> | null,
  branchId: string
): boolean {
  if (!custodian) return false;
  if (!Boolean(custodian.is_active)) return false;
  return String(custodian.branch_id) === branchId;
}
