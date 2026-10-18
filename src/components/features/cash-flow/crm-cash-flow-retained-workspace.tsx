"use client";

import { useCallback } from "react";
import type { FinancialEntryMode } from "./record-financial-entry-modal";
import type {
  CrmCashFlowTab,
  CrmCashFlowWorkspacePayload,
} from "./crm-cash-flow-workspace-data";
import { CashFlowWorkspace } from "./cash-flow-workspace";
import { useLiveCrmCashFlowData } from "./use-live-crm-cash-flow-data";

type Props = {
  initialPayload: CrmCashFlowWorkspacePayload;
  initialTab: CrmCashFlowTab;
  initialEntryMode: FinancialEntryMode | null;
  handoverSessionId?: string | null;
  incomingStaffId?: string | null;
};

export function CrmCashFlowRetainedWorkspace({
  initialPayload,
  initialTab,
  initialEntryMode,
  handoverSessionId = null,
  incomingStaffId = null,
}: Props) {
  const live = useLiveCrmCashFlowData(initialPayload);
  const payload = live.data ?? initialPayload;

  const handleConfirmedMutation = useCallback(() => {
    live.generation.store?.invalidate("crm-cash-flow");
  }, [live.generation.store]);

  const handleRefresh = useCallback(
    () => live.revalidate(),
    [live.revalidate]
  );

  return (
    <div className="space-y-3">
      {live.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>
            Cash Flow could not refresh. The last validated financial
            snapshot is still displayed.
          </span>
          <button
            type="button"
            className="cs-btn cs-btn-secondary cs-btn-sm"
            onClick={() => void handleRefresh()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <CashFlowWorkspace
        initialData={payload.data}
        initialTab={initialTab}
        initialEntryMode={initialEntryMode}
        handoverSessionId={handoverSessionId}
        incomingStaffId={incomingStaffId}
        onRefresh={handleRefresh}
        onConfirmedMutation={handleConfirmedMutation}
        externallyRefreshing={live.generation.isRefreshing}
        syncCrmRouteState
      />
    </div>
  );
}
