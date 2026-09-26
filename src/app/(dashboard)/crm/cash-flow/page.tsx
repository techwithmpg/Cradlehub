import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";
import { getCashFlowWorkspace } from "@/lib/queries/cash-flow";

export default async function CashFlowPage() {
  const data = await getCashFlowWorkspace();
  return <CashFlowWorkspace key={data.branchId} initialData={data} />;
}
