/** @vitest-environment jsdom */

import { useState, type PropsWithChildren } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import {
  WorkspaceModuleLifecycleContext,
  type WorkspaceModuleLifecycleValue,
} from "@/components/features/dashboard/use-workspace-visibility";
import { useLiveOwnerOverviewData } from "@/components/features/owner/dashboard/use-live-owner-overview-data";
import { refreshOwnerOverviewWorkspaceAction } from "@/lib/actions/owner-overview-data-actions";
import type { OwnerOverviewWorkspacePayload } from "@/components/features/owner/dashboard/owner-overview-workspace-data";
import type { OwnerOverviewDashboardData } from "@/lib/queries/owner-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";

vi.mock("@/lib/actions/owner-overview-data-actions", () => ({
  refreshOwnerOverviewWorkspaceAction: vi.fn(),
}));

const fallback = {
  data: {
    ownerName: "Owner",
    today: "2026-10-18",
    todayLabel: "October 18, 2026",
    generatedAt: "2026-10-18T08:00:00.000Z",
    kpis: { status: "error", message: "fixture" },
    attention: { status: "ready", data: [] },
    todayGlance: { status: "error", message: "fixture" },
    branchPerformance: { status: "error", message: "fixture" },
    revenueTrend: { status: "error", message: "fixture" },
    staffSnapshot: { status: "error", message: "fixture" },
    payroll: { status: "error", message: "fixture" },
    pendingActions: { status: "ready", data: [] },
  } as OwnerOverviewDashboardData,
  attendanceScanFeed: {
    selectedDate: "2026-10-18",
    timezone: "Asia/Manila",
    branchId: null,
    branchName: null,
    items: [],
    lastHourCount: 0,
    lastHourOperations: [],
    nextCursor: null,
    error: null,
  } as AttendanceScanFeedData,
} satisfies OwnerOverviewWorkspacePayload;

function lifecycle(
  overrides: Partial<WorkspaceModuleLifecycleValue>
): WorkspaceModuleLifecycleValue {
  return {
    isActive: true,
    isRetained: true,
    isDirty: false,
    isStale: true,
    isRefreshing: false,
    hasUnsavedChanges: false,
    becameActiveAt: 100,
    invalidationGeneration: 0,
    validatedGeneration: 0,
    markDirty: vi.fn(),
    markClean: vi.fn(),
    setRefreshing: vi.fn(),
    setUnsavedChanges: vi.fn(),
    ...overrides,
  };
}

function Harness() {
  useLiveOwnerOverviewData(fallback);
  return null;
}

function Providers({
  children,
  lifecycleValue,
  store,
}: PropsWithChildren<{
  lifecycleValue: WorkspaceModuleLifecycleValue;
  store: ReturnType<typeof createWorkspaceGenerationStore>;
}>) {
  const [cache] = useState(() => new Map());
  return (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value="owner-1:owner:owner:all-branches">
        <WorkspaceGenerationContext.Provider value={store}>
          <WorkspaceModuleLifecycleContext.Provider value={lifecycleValue}>
            {children}
          </WorkspaceModuleLifecycleContext.Provider>
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.mocked(refreshOwnerOverviewWorkspaceAction).mockReset();
  vi.mocked(refreshOwnerOverviewWorkspaceAction).mockResolvedValue(fallback);
});

afterEach(() => {
  cleanup();
});

describe("PERF-9A Owner Overview stale retained reactivation", () => {
  it("reconciles a clean stale Owner Overview once per activation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-overview");
    const value = lifecycle({ becameActiveAt: 100 });

    const view = render(
      <Providers lifecycleValue={value} store={store}>
        <Harness />
      </Providers>
    );

    await waitFor(() =>
      expect(refreshOwnerOverviewWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    view.rerender(
      <Providers
        lifecycleValue={lifecycle({ becameActiveAt: 100 })}
        store={store}
      >
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshOwnerOverviewWorkspaceAction).toHaveBeenCalledTimes(1);
  });

  it("performs no stale refresh while Owner Overview is hidden", async () => {
    const store = createWorkspaceGenerationStore();

    render(
      <Providers
        lifecycleValue={lifecycle({
          isActive: false,
          becameActiveAt: 100,
        })}
        store={store}
      >
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshOwnerOverviewWorkspaceAction).not.toHaveBeenCalled();
  });
});
