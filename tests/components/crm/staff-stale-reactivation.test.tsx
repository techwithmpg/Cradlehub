/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
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
import { useLiveCrmStaffData } from "@/components/features/crm/staff/use-live-crm-staff-data";
import { refreshCrmStaffWorkspaceAction } from "@/lib/actions/crm-staff-data-actions";
import type { CrmStaffWorkspaceData } from "@/components/features/crm/staff/crm-staff-workspace-data";

vi.mock("@/lib/actions/crm-staff-data-actions", () => ({
  refreshCrmStaffWorkspaceAction: vi.fn(),
}));

const fallback: CrmStaffWorkspaceData = {
  branchId: "branch-a",
  branchName: "Main",
  reviewerSystemRole: "crm",
  reviewerBranchId: "branch-a",
  canReviewOnboarding: false,
  allStaff: [],
  pendingStaff: [],
  branches: [],
  activeServices: [],
  providerStaff: [],
  providerAssignments: [],
  providerAssignmentsError: null,
  onboardingRequests: [],
  branchCorrectionRequests: [],
};

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
    markDirty: vi.fn(),
    markClean: vi.fn(),
    setRefreshing: vi.fn(),
    setUnsavedChanges: vi.fn(),
    ...overrides,
  };
}

function Harness() {
  useLiveCrmStaffData(fallback);
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
  const cache = new Map();
  return (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-a">
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
  vi.mocked(refreshCrmStaffWorkspaceAction).mockReset();
  vi.mocked(refreshCrmStaffWorkspaceAction).mockResolvedValue(fallback);
});

afterEach(() => {
  cleanup();
});

describe("PERF-7 CRM Staff stale retained reactivation", () => {
  it("reconciles a clean stale Staff module once for the current activation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-staff");
    const value = lifecycle({ becameActiveAt: 100 });

    const view = render(
      <Providers lifecycleValue={value} store={store}>
        <Harness />
      </Providers>
    );

    await waitFor(() =>
      expect(refreshCrmStaffWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    view.rerender(
      <Providers
        lifecycleValue={lifecycle({
          becameActiveAt: 100,
          isRefreshing: false,
        })}
        store={store}
      >
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshCrmStaffWorkspaceAction).toHaveBeenCalledTimes(1);
  });

  it("does not fetch a stale Staff module while hidden", async () => {
    const store = createWorkspaceGenerationStore();
    const value = lifecycle({
      isActive: false,
      becameActiveAt: 100,
    });

    render(
      <Providers lifecycleValue={value} store={store}>
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshCrmStaffWorkspaceAction).not.toHaveBeenCalled();
  });
});
