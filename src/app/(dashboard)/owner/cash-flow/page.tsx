import Link from "next/link";
import { redirect } from "next/navigation";
import { CashFlowWorkspace, type CashFlowTab } from "@/components/features/cash-flow/cash-flow-workspace";
import type { FinancialEntryMode } from "@/components/features/cash-flow/record-financial-entry-modal";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, hasWorkspaceAccess } from "@/lib/auth/workspace-access";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";
import { getCashFlowData } from "@/lib/cash-flow/cash-flow-queries";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getAllBranches } from "@/lib/queries/branches";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function OwnerCashFlowPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }

  const [params, branches] = await Promise.all([searchParams, getAllBranches()]);
  if (branches.length === 0) {
    return (
      <section className="cs-card p-6" role="status">
        <h1 className="text-xl font-semibold">Cash Flow</h1>
        <p className="mt-2 text-sm">Configure an active branch to view financial activity.</p>
        <Link className="mt-3 inline-block underline" href="/owner/branches">Manage branches</Link>
      </section>
    );
  }

  const requestedBranchId = typeof params.branchId === "string" ? params.branchId : "";
  const branch = branches.find((item) => item.id === requestedBranchId) ?? branches[0]!;
  const today = getBranchBusinessDate();
  const selectedDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : today;
  const requestedTab = params.tab;
  const initialTab: CashFlowTab =
    requestedTab === "ledger" || requestedTab === "day-close" || requestedTab === "history"
      ? requestedTab
      : "today";
  const initialEntryMode: FinancialEntryMode | null =
    params.entry === "payment" ? "customer_payment"
      : params.entry === "expense" ? "expense"
        : params.entry === "cash-operations" ? "other_entry" : null;

  const filters = {
    tab: initialTab,
    search: typeof params.search === "string" ? params.search : undefined,
    category: typeof params.category === "string" ? params.category : undefined,
    method: typeof params.method === "string" ? params.method : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    page: typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1,
  };

  const branchControls = (
    <form method="get" className="flex flex-wrap items-end gap-3 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
      <label className="grid gap-1 text-xs font-semibold text-[var(--cs-text)]">
        Branch
        <select name="branchId" defaultValue={branch.id} className="h-10 min-w-44 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm">
          {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-[var(--cs-text)]">
        Business date
        <input type="date" name="date" defaultValue={selectedDate} className="h-10 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm" />
      </label>
      <input type="hidden" name="tab" value={initialTab} />
      <button type="submit" className="h-10 rounded-lg bg-[#163E32] px-4 text-sm font-semibold text-white">View Cash Flow</button>
    </form>
  );

  let cashFlowData;
  try {
    cashFlowData = await getCashFlowData(branch.id, branch.name, selectedDate, filters);
  } catch (error) {
    if (!(error instanceof CashFlowRequiredDataError)) throw error;
    return (
      <div className="min-w-0">
        {branchControls}
        <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-950">Cash Flow is unavailable</h1>
          <p className="mt-2 text-sm text-amber-900">
            Required financial data could not be loaded. Ask an administrator to check the Cash Flow database setup.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {branchControls}
      <CashFlowWorkspace
        key={`${branch.id}:${selectedDate}`}
        initialData={cashFlowData}
        initialTab={initialTab}
        initialEntryMode={initialEntryMode}
        reconciliationHref={null}
      />
    </div>
  );
}
