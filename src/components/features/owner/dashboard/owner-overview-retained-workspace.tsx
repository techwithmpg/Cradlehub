"use client";

import { useCallback } from "react";
import { OwnerDashboard } from "./owner-dashboard";
import type { OwnerOverviewWorkspacePayload } from "./owner-overview-workspace-data";
import { useLiveOwnerOverviewData } from "./use-live-owner-overview-data";

export function OwnerOverviewRetainedWorkspace({
  initialPayload,
}: {
  initialPayload: OwnerOverviewWorkspacePayload;
}) {
  const live = useLiveOwnerOverviewData(initialPayload);
  const payload = live.data ?? initialPayload;
  const { revalidate } = live;

  const handleRetry = useCallback(async () => {
    await revalidate();
  }, [revalidate]);

  return (
    <div className="space-y-3">
      {live.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>
            Owner Overview could not refresh. The last validated dashboard
            snapshot is still displayed.
          </span>
          <button
            type="button"
            className="cs-btn cs-btn-secondary cs-btn-sm"
            onClick={() => void handleRetry()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <OwnerDashboard
        data={payload.data}
        attendanceScanFeed={payload.attendanceScanFeed}
      />
    </div>
  );
}
