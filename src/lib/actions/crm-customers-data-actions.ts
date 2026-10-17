"use server";

import { getCrmContext } from "@/lib/queries/crm-context";
import { loadCrmCustomersWorkspaceData } from "@/lib/queries/crm-customers-workspace";
import {
  normalizeCustomerPage,
  normalizeCustomerSearch,
  normalizeCustomerTab,
  type CrmCustomersWorkspaceData,
} from "@/components/features/crm/customers/customer-workspace-data";

export async function refreshCrmCustomersWorkspaceAction(
  rawInput: unknown
): Promise<CrmCustomersWorkspaceData> {
  const input =
    rawInput && typeof rawInput === "object"
      ? (rawInput as Record<string, unknown>)
      : {};
  const { branchId } = await getCrmContext();

  const request = {
    tab: normalizeCustomerTab(
      typeof input.tab === "string" ? input.tab : undefined
    ),
    page: normalizeCustomerPage(
      typeof input.page === "number" || typeof input.page === "string"
        ? String(input.page)
        : undefined
    ),
    search: normalizeCustomerSearch(
      typeof input.search === "string" ? input.search : undefined
    ),
  };

  return loadCrmCustomersWorkspaceData({
    branchId,
    request,
  });
}
