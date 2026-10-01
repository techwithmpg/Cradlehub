"use server";

import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { CashFlowRequiredDataError } from "./cash-flow-errors";
import { getCashFlowData } from "./cash-flow-queries";
import type { CashFlowWorkspaceData } from "./cash-flow-types";

export type FinancialEntryContext = Pick<
  CashFlowWorkspaceData,
  | "branchId"
  | "businessDate"
  | "accounts"
  | "expenseCategories"
  | "staffOptions"
  | "payableOrders"
  | "cashSessions"
>;

export async function loadFinancialEntryContextAction(): Promise<
  | { ok: true; data: FinancialEntryContext }
  | { ok: false; error: string }
> {
  const { branchId, branchName } = await getFrontDeskContext();
  const businessDate = getBranchBusinessDate();

  try {
    // Reuse the same branch-scoped options and payable-order calculation as Cash Flow.
    const data = await getCashFlowData(branchId, branchName, businessDate);
    return {
      ok: true,
      data: {
        branchId: data.branchId,
        businessDate: data.businessDate,
        accounts: data.accounts,
        expenseCategories: data.expenseCategories,
        staffOptions: data.staffOptions,
        payableOrders: data.payableOrders,
        cashSessions: data.cashSessions,
      },
    };
  } catch (error) {
    if (error instanceof CashFlowRequiredDataError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
