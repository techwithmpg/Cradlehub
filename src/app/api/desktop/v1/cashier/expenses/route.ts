import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  DesktopExpensePayloadSchema,
  desktopJson,
  desktopFailure,
  type GenericRpcClient,
  type DynamicCategoryClient,
} from "@/lib/cashier/desktop-cashier-contract";

export async function POST(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return desktopFailure("INVALID_JSON", "Invalid JSON in request body.", 400);
    }

    const parsed = DesktopExpensePayloadSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join("; ");
      return desktopFailure("VALIDATION_ERROR", errorMsg, 400);
    }

    const input = parsed.data;

    // Validate expense category exists and is active
    const { data: category, error: catError } = await (ctx.supabase as unknown as DynamicCategoryClient)
      .from("financial_expense_categories")
      .select("id, is_active")
      .eq("id", input.categoryId)
      .maybeSingle();

    if (catError || !category || !category.is_active) {
      return desktopFailure("CATEGORY_INVALID", "Expense category is invalid or inactive.", 400);
    }

    // Verify financial account belongs to branch, is active, and disbursement eligible
    const { data: account, error: accError } = await ctx.supabase
      .from("financial_accounts")
      .select("id, branch_id, is_active, account_type")
      .eq("id", input.financialAccountId)
      .maybeSingle();

    if (accError || !account) {
      return desktopFailure("ACCOUNT_NOT_FOUND", "Financial account not found.", 404);
    }

    if (!account.is_active) {
      return desktopFailure("ACCOUNT_INACTIVE", "Financial account is inactive.", 400);
    }

    if (account.branch_id && account.branch_id !== ctx.branchId) {
      return desktopFailure("ACCOUNT_WRONG_BRANCH", "Account does not belong to active branch.", 403);
    }

    // Call atomic expense writer
    const { data, error } = await (ctx.supabase as unknown as GenericRpcClient).rpc("post_expense_atomic", {
      p_branch_id: ctx.branchId,
      p_idempotency_key: input.idempotencyKey,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_financial_account_id: input.financialAccountId,
      p_payee: input.payee,
      p_description: input.description,
      p_receipt_reference: input.receiptReference ?? null,
      p_business_date: input.businessDate ?? ctx.businessDate,
      p_notes: input.notes ?? null,
      p_receipt_image_path: null,
    });

    if (error) {
      return desktopFailure(error.code || "RPC_ERROR", error.message, 400);
    }

    if (!data || (typeof data === "object" && (("success" in data && (data as Record<string, unknown>).success === false) || ("ok" in data && (data as Record<string, unknown>).ok === false)))) {
      const errMessage = (typeof (data as Record<string, unknown>)?.error === "string" && (data as Record<string, unknown>).error) || "Expense posting was rejected.";
      return desktopFailure("EXPENSE_REJECTED", String(errMessage), 400);
    }

    return desktopJson({
      ok: true,
      data,
    });
  });
}
