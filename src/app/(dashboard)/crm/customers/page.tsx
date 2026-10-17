import { getCrmContext } from "@/lib/queries/crm-context";
import { loadCrmCustomersWorkspaceData } from "@/lib/queries/crm-customers-workspace";
import { CustomersWorkspace } from "@/components/features/crm/customers/customers-workspace";
import {
  normalizeCustomerPage,
  normalizeCustomerSearch,
  normalizeCustomerTab,
} from "@/components/features/crm/customers/customer-workspace-data";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

export default async function CrmCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { branchId } = await getCrmContext();
  const params = await searchParams;
  const request = {
    tab: normalizeCustomerTab(params.tab),
    page: normalizeCustomerPage(params.page),
    search: normalizeCustomerSearch(params.q),
  };
  const initialData = await loadCrmCustomersWorkspaceData({
    branchId,
    request,
  });

  return (
    <RetainedWorkspaceModule moduleId="crm-customers">
      <CustomersWorkspace initialData={initialData} />
    </RetainedWorkspaceModule>
  );
}
