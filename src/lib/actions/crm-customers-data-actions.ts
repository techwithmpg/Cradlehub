"use server";

import { getCrmContext } from "@/lib/queries/crm-context";
import { loadCrmCustomersWorkspaceData } from "@/lib/queries/crm-customers-workspace";
import {
  normalizeCustomerPage,
  normalizeCustomerSearch,
  normalizeCustomerTab,
  type CrmCustomersWorkspaceData,
} from "@/components/features/crm/customers/customer-workspace-data";

export async function refreshCrmCustomersWorkspaceAction(input: {
  tab?: string;
  page?: number;
  search?: string;
}): Promise<CrmCustomersWorkspaceData> {
  const { branchId } = await getCrmContext();

  const request = {
    tab: normalizeCustomerTab(input.tab),
    page: normalizeCustomerPage(String(input.page ?? 1)),
    search: normalizeCustomerSearch(input.search),
  };

  return loadCrmCustomersWorkspaceData({
    branchId,
    request,
  });
}
