/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveOwnerOverviewData } from "@/components/features/owner/dashboard/use-live-owner-overview-data";
import { refreshOwnerOverviewWorkspaceAction } from "@/lib/actions/owner-overview-data-actions";
import type { OwnerOverviewWorkspacePayload } from "@/components/features/owner/dashboard/owner-overview-workspace-data";
import type { OwnerOverviewDashboardData } from "@/lib/queries/owner-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";

vi.mock("@/lib/actions/owner-overview-data-actions", () => ({
  refreshOwnerOverviewWorkspaceAction: vi.fn(),
}));

function payload(label: string): OwnerOverviewWorkspacePayload {
  const data = {
    ownerName: label,
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
  } as OwnerOverviewDashboardData;

  const attendanceScanFeed = {
    selectedDate: "2026-10-18",
    timezone: "Asia/Manila",
    branchId: null,
    branchName: null,
    items: [],
    lastHourCount: 0,
    lastHourOperations: [],
    nextCursor: null,
    error: null,
  } as AttendanceScanFeedData;

  return { data, attendanceScanFeed };
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
      <WorkspaceSWRScopeContext.Provider value="owner-1:owner:owner:all-branches">
        <WorkspaceGenerationContext.Provider value={store}>
          {children}
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
  Wrapper.displayName = "OwnerOverviewGenerationTestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(refreshOwnerOverviewWorkspaceAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-9A generation-aware Owner Overview reads", () => {
  it("renders the server fallback with zero duplicate initial fetch", () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-overview");

    const { result } = renderHook(
      () => useLiveOwnerOverviewData(payload("Initial Owner")),
      { wrapper: wrapperFor(store) }
    );

    expect(result.current.data?.data.ownerName).toBe("Initial Owner");
    expect(refreshOwnerOverviewWorkspaceAction).not.toHaveBeenCalled();
  });

  it("performs zero canonical reads while hidden, including focus and reconnect", () => {
    const store = createWorkspaceGenerationStore();

    renderHook(
      () => useLiveOwnerOverviewData(payload("Retained Owner")),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("owner-overview");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refreshOwnerOverviewWorkspaceAction).not.toHaveBeenCalled();
    expect(store.getSnapshot("owner-overview").isDirty).toBe(true);
  });

  it("reconciles once when dirty retained Owner Overview becomes active", async () => {
    const store = createWorkspaceGenerationStore();
    vi.mocked(refreshOwnerOverviewWorkspaceAction).mockResolvedValue(
      payload("Fresh Owner")
    );

    const { result } = renderHook(
      () => useLiveOwnerOverviewData(payload("Retained Owner")),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("owner-overview");
      store.setActive("owner-overview");
    });

    await waitFor(() =>
      expect(refreshOwnerOverviewWorkspaceAction).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(result.current.data?.data.ownerName).toBe("Fresh Owner")
    );
    expect(store.getSnapshot("owner-overview").isDirty).toBe(false);
  });

  it("rejects an older Owner Overview response after a newer invalidation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-overview");
    const first = deferred<OwnerOverviewWorkspacePayload>();
    const second = deferred<OwnerOverviewWorkspacePayload>();

    vi.mocked(refreshOwnerOverviewWorkspaceAction)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(
      () => useLiveOwnerOverviewData(payload("Retained Owner")),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("owner-overview"));

    await waitFor(() =>
      expect(refreshOwnerOverviewWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    act(() => store.invalidate("owner-overview"));
    first.resolve(payload("STALE OWNER"));

    await waitFor(() =>
      expect(refreshOwnerOverviewWorkspaceAction).toHaveBeenCalledTimes(2)
    );
    expect(result.current.data?.data.ownerName).toBe("Retained Owner");

    second.resolve(payload("Fresh Owner"));

    await waitFor(() =>
      expect(result.current.data?.data.ownerName).toBe("Fresh Owner")
    );
  });
});
