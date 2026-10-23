import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  getDesktopDrawers,
  DesktopDrawerSessionActionSchema,
  desktopJson,
  desktopFailure,
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
      const { data, error } = await ctx.supabase.rpc("open_cash_session_atomic", {
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
      return desktopJson({ ok: true, data });
    }

    if (action.action === "handover") {
      const { data, error } = await ctx.supabase.rpc("handover_cash_session_atomic", {
        p_session_id: action.sessionId,
        p_incoming_custodian_id: action.incomingCustodianId,
        p_counted_cash: action.countedCash,
        p_notes: action.notes ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      return desktopJson({ ok: true, data });
    }

    if (action.action === "close") {
      const { data, error } = await ctx.supabase.rpc("close_cash_session_atomic", {
        p_session_id: action.sessionId,
        p_counted_cash: action.countedCash,
        p_closing_note: action.closingNote ?? null,
        p_idempotency_key: action.idempotencyKey,
      });

      if (error) {
        return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
      }
      return desktopJson({ ok: true, data });
    }

    if (action.action === "adjustment") {
      const { data, error } = await ctx.supabase.rpc("post_cash_adjustment_atomic", {
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
      return desktopJson({ ok: true, data });
    }

    return desktopFailure("UNKNOWN_ACTION", "Unsupported drawer operation.", 400);
  });
}
