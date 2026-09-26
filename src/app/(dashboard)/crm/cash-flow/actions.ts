"use server";
import { getCashFlowWorkspace } from "@/lib/queries/cash-flow";
import type { CashFlowRange } from "@/lib/cash-flow/read-model";

export async function refreshCashFlow(range: CashFlowRange) {
  // Auth redirects propagate. Do not turn an expired session into an empty ledger.
  return getCashFlowWorkspace(range);
}
