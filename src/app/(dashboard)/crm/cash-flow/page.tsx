import { getFrontDeskContext } from '@/lib/queries/crm-context';
import { getBranchBusinessDate } from '@/lib/engine/slot-time';
import { getCashFlowData } from '@/lib/cash-flow/cash-flow-queries';
import { CashFlowWorkspace } from '@/components/features/cash-flow/cash-flow-workspace';

export default async function CrmCashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { branchId, branchName } = await getFrontDeskContext();
  const params = await searchParams;

  const today = getBranchBusinessDate();
  const selectedDate = typeof params.date === 'string' ? params.date : today;

  const filters = {
    tab: typeof params.tab === 'string' ? params.tab : 'today',
    search: typeof params.search === 'string' ? params.search : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    method: typeof params.method === 'string' ? params.method : undefined,
    status: typeof params.status === 'string' ? params.status : undefined,
    page: typeof params.page === 'string' ? parseInt(params.page, 10) : 1,
  };

  const cashFlowData = await getCashFlowData(branchId, branchName, selectedDate, filters);

  return <CashFlowWorkspace initialData={cashFlowData} />;
}
