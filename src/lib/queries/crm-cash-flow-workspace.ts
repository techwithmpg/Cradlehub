import "server-only";

import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import {
  normalizeCrmCashFlowRequest,
  type CrmCashFlowRequest,
  type CrmCashFlowWorkspacePayload,
} from "@/components/features/cash-flow/crm-cash-flow-workspace-data";

export type CrmCashFlowServerContext = {
  userId: string;
  role: string;
  branchId: string;
  branchName: string;
};

export type CrmCashFlowLoadResult = {
  context: CrmCashFlowServerContext;
  payload: CrmCashFlowWorkspacePayload;
};

export async function loadCrmCashFlowWorkspaceData(
  request: CrmCashFlowRequest = {}
): Promise<CrmCashFlowLoadResult> {
  const context = await getFrontDeskContext();
  const today = getBranchBusinessDate();

  const normalizedRequest = normalizeCrmCashFlowRequest(
    request,
    today
  );
  const businessDate = normalizedRequest.date ?? today;

  const data = await getCashFlowData(
    context.branchId,
    context.branchName,
    businessDate,
    {
      search: normalizedRequest.search,
      category: normalizedRequest.category,
      method: normalizedRequest.method,
      status: normalizedRequest.status,
      page: normalizedRequest.page,
    }
  );

  return {
    context: {
      userId: context.userId,
      role: context.role,
      branchId: context.branchId,
      branchName: context.branchName,
    },
    payload: {
      data,
      request: normalizedRequest,
    },
  };
}
