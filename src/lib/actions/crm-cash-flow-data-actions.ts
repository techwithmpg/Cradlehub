"use server";

import type {
  CrmCashFlowRequest,
  CrmCashFlowWorkspacePayload,
} from "@/components/features/cash-flow/crm-cash-flow-workspace-data";
import { loadCrmCashFlowWorkspaceData } from "@/lib/queries/crm-cash-flow-workspace";

export async function refreshCrmCashFlowWorkspaceAction(
  request: CrmCashFlowRequest
): Promise<CrmCashFlowWorkspacePayload> {
  const result = await loadCrmCashFlowWorkspaceData(request);
  return result.payload;
}
