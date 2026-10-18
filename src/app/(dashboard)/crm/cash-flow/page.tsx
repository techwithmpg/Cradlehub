import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { CrmCashFlowRetainedWorkspace } from "@/components/features/cash-flow/crm-cash-flow-retained-workspace";
import {
  normalizeCrmCashFlowEntryMode,
  normalizeCrmCashFlowTab,
  type CrmCashFlowRequest,
} from "@/components/features/cash-flow/crm-cash-flow-workspace-data";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";
import { loadCrmCashFlowWorkspaceData } from "@/lib/queries/crm-cash-flow-workspace";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function CrmCashFlowPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialTab = normalizeCrmCashFlowTab(params.tab);
  const initialEntryMode = normalizeCrmCashFlowEntryMode(
    params.entry
  );

  const request: CrmCashFlowRequest = {
    date: typeof params.date === "string" ? params.date : undefined,
    search:
      typeof params.search === "string" ? params.search : undefined,
    category:
      typeof params.category === "string"
        ? params.category
        : undefined,
    method:
      typeof params.method === "string" ? params.method : undefined,
    status:
      typeof params.status === "string" ? params.status : undefined,
    page:
      typeof params.page === "string"
        ? Number.parseInt(params.page, 10)
        : 1,
  };

  let result;
  try {
    result = await loadCrmCashFlowWorkspaceData(request);
  } catch (error) {
    if (!(error instanceof CashFlowRequiredDataError)) throw error;

    return (
      <section
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6"
      >
        <h1 className="text-xl font-semibold text-amber-950">
          Cash Flow is unavailable
        </h1>
        <p className="mt-2 text-sm text-amber-900">
          Required financial data could not be loaded. Ask an
          administrator to check the Cash Flow database setup.
        </p>
      </section>
    );
  }

  const requestedHandover =
    typeof params.handover === "string" ? params.handover : null;
  let incomingStaffId: string | null = null;

  if (requestedHandover && result.context.role === "crm") {
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", result.context.userId)
      .eq("branch_id", result.context.branchId)
      .eq("is_active", true)
      .maybeSingle();

    incomingStaffId = member?.id ?? null;
  }

  return (
    <RetainedWorkspaceModule moduleId="crm-cash-flow">
      <CrmCashFlowRetainedWorkspace
        initialPayload={result.payload}
        initialTab={initialTab}
        initialEntryMode={initialEntryMode}
        handoverSessionId={
          incomingStaffId ? requestedHandover : null
        }
        incomingStaffId={incomingStaffId}
      />
    </RetainedWorkspaceModule>
  );
}
