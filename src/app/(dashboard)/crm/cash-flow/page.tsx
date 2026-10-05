import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";
import {
  CashFlowWorkspace,
  type CashFlowTab,
} from "@/components/features/cash-flow/cash-flow-workspace";
import type { FinancialEntryMode } from "@/components/features/cash-flow/record-financial-entry-modal";
import { createClient } from "@/lib/supabase/server";

export default async function CrmCashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { branchId, branchName, role, userId } = await getFrontDeskContext();
  const params = await searchParams;
  const requestedHandover = typeof params.handover === "string" ? params.handover : null;
  let incomingStaffId: string | null = null;
  if (requestedHandover && role === "crm") {
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .maybeSingle();
    incomingStaffId = member?.id ?? null;
  }
  const requestedTab = params.tab;
  const initialTab: CashFlowTab =
    requestedTab === "ledger" || requestedTab === "day-close" || requestedTab === "history"
      ? requestedTab
      : "today";
  const initialEntryMode: FinancialEntryMode | null =
    params.entry === "payment"
      ? "customer_payment"
      : params.entry === "expense"
        ? "expense"
        : params.entry === "cash-operations"
          ? "other_entry"
          : null;

  const today = getBranchBusinessDate();
  const selectedDate = typeof params.date === "string" ? params.date : today;

  const filters = {
    tab: initialTab,
    search: typeof params.search === "string" ? params.search : undefined,
    category: typeof params.category === "string" ? params.category : undefined,
    method: typeof params.method === "string" ? params.method : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    page: typeof params.page === "string" ? parseInt(params.page, 10) : 1,
  };

  let cashFlowData;
  try {
    cashFlowData = await getCashFlowData(branchId, branchName, selectedDate, filters);
  } catch (error) {
    if (!(error instanceof CashFlowRequiredDataError)) throw error;

    return (
      <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-950">Cash Flow is unavailable</h1>
        <p className="mt-2 text-sm text-amber-900">
          Required financial data could not be loaded. Ask an administrator to check the Cash Flow
          database setup.
        </p>
      </section>
    );
  }

  return (
    <CashFlowWorkspace
      initialData={cashFlowData}
      initialTab={initialTab}
      initialEntryMode={initialEntryMode}
      handoverSessionId={incomingStaffId ? requestedHandover : null}
      incomingStaffId={incomingStaffId}
    />
  );
}
