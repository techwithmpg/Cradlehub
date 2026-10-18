/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveCrmStaffData } from "@/components/features/crm/staff/use-live-crm-staff-data";
import { refreshCrmStaffWorkspaceAction } from "@/lib/actions/crm-staff-data-actions";
import type { CrmStaffWorkspaceData } from "@/components/features/crm/staff/crm-staff-workspace-data";

vi.mock("@/lib/actions/crm-staff-data-actions", () => ({
  refreshCrmStaffWorkspaceAction: vi.fn(),
}));

function staffData(label: string): CrmStaffWorkspaceData {
  return {
    branchId: "branch-a",
    branchName: "Main Branch",
    reviewerSystemRole: "crm",
    reviewerBranchId: "branch-a",
    canReviewOnboarding: true,
    allStaff: [
      {
        id: `staff-${label}`,
        full_name: label,
        nickname: null,
        phone: null,
        branch_id: "branch-a",
        branches: { id: "branch-a", name: "Main Branch" },
        system_role: "staff",
        staff_type: "therapist",
        tier: "senior",
        is_active: true,
        auth_user_id: null,
      } as CrmStaffWorkspaceData["allStaff"][number],
    ],
    pendingStaff: [],
    branches: [{ id: "branch-a", name: "Main Branch" }],
    activeServices: [],
    providerStaff: [],
    providerAssignments: [],
    providerAssignmentsError: null,
    onboardingRequests: [],
    branchCorrectionRequests: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function wrapperFor(
  store: ReturnType<typeof createWorkspaceGenerationStore>
) {
  const cache = new Map();
  const Wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-a">
        <WorkspaceGenerationContext.Provider value={store}>
          {children}
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
  Wrapper.displayName = "CrmStaffGenerationTestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(refreshCrmStaffWorkspaceAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-7 generation-aware CRM Staff reads", () => {
  it("renders the server fallback with zero duplicate initial fetch", () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-staff");
    const fallback = staffData("Initial Staff");

    const { result } = renderHook(
      () => useLiveCrmStaffData(fallback),
      { wrapper: wrapperFor(store) }
    );

    expect(result.current.data?.allStaff[0]?.full_name).toBe(
      "Initial Staff"
    );
    expect(refreshCrmStaffWorkspaceAction).not.toHaveBeenCalled();
  });

  it("performs zero canonical reads while hidden, including focus and reconnect", () => {
    const store = createWorkspaceGenerationStore();
    const fallback = staffData("Retained Staff");

    renderHook(
      () => useLiveCrmStaffData(fallback),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-staff");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refreshCrmStaffWorkspaceAction).not.toHaveBeenCalled();
    expect(store.getSnapshot("crm-staff").isDirty).toBe(true);
  });

  it("reconciles exactly once when a dirty retained Staff module becomes active", async () => {
    const store = createWorkspaceGenerationStore();
    const fallback = staffData("Retained Staff");
    vi.mocked(refreshCrmStaffWorkspaceAction).mockResolvedValue(
      staffData("Fresh Staff")
    );

    const { result } = renderHook(
      () => useLiveCrmStaffData(fallback),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-staff");
      store.setActive("crm-staff");
    });

    await waitFor(() =>
      expect(refreshCrmStaffWorkspaceAction).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(result.current.data?.allStaff[0]?.full_name).toBe(
        "Fresh Staff"
      )
    );
    expect(store.getSnapshot("crm-staff").isDirty).toBe(false);
  });

  it("rejects a stale Staff response after a newer invalidation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-staff");
    const first = deferred<CrmStaffWorkspaceData>();
    const second = deferred<CrmStaffWorkspaceData>();

    vi.mocked(refreshCrmStaffWorkspaceAction)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const fallback = staffData("Retained Staff");
    const { result } = renderHook(
      () => useLiveCrmStaffData(fallback),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("crm-staff"));

    await waitFor(() =>
      expect(refreshCrmStaffWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    act(() => store.invalidate("crm-staff"));
    first.resolve(staffData("STALE Staff"));

    await waitFor(() =>
      expect(refreshCrmStaffWorkspaceAction).toHaveBeenCalledTimes(2)
    );
    expect(result.current.data?.allStaff[0]?.full_name).toBe(
      "Retained Staff"
    );

    second.resolve(staffData("Fresh Staff"));

    await waitFor(() =>
      expect(result.current.data?.allStaff[0]?.full_name).toBe(
        "Fresh Staff"
      )
    );
    expect(store.getSnapshot("crm-staff").isDirty).toBe(false);
  });
});
