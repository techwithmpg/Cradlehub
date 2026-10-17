/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import {
  WorkspaceGenerationContext,
} from "@/components/features/dashboard/use-workspace-generation";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import {
  type DailyScheduleApiResponse,
  useLiveDailySchedule,
} from "@/components/features/schedule/hooks/use-live-daily-schedule";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function schedulePayload(label: string): DailyScheduleApiResponse {
  return {
    branchId: "branch-1",
    branchName: label,
    staffRows: [],
    branchResources: [],
    stats: {
      total: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    },
    readiness: null,
    schedulingRules: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

describe("PERF-4 generation-aware CRM Schedule reads", () => {
  it("keeps retained data visible and performs zero hidden network requests", async () => {
    const store = createWorkspaceGenerationStore();
    const cache = new Map();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = deferred<Response>();
    fetchSpy.mockReturnValue(response.promise);

    const wrapper = ({ children }: PropsWithChildren) => (
      <SWRConfig value={{ provider: () => cache }}>
        <WorkspaceSWRScopeContext.Provider value="user-a:crm:branch-1">
          <WorkspaceGenerationContext.Provider value={store}>
            {children}
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

    const fallback = schedulePayload("retained");
    const { result } = renderHook(
      () => useLiveDailySchedule({ date: "2026-10-17", fallbackData: fallback }),
      { wrapper }
    );

    act(() => {
      store.invalidate("crm-schedule");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.data?.branchName).toBe("retained");

    act(() => store.setActive("crm-schedule"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(result.current.data?.branchName).toBe("retained");

    response.resolve(
      new Response(JSON.stringify(schedulePayload("server")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.data?.branchName).toBe("server"));
    expect(result.current.generation.isDirty).toBe(false);
  });

  it("discards a stale schedule response after a newer invalidation", async () => {
    const store = createWorkspaceGenerationStore();
    const cache = new Map();
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const wrapper = ({ children }: PropsWithChildren) => (
      <SWRConfig value={{ provider: () => cache }}>
        <WorkspaceSWRScopeContext.Provider value="user-a:crm:branch-1">
          <WorkspaceGenerationContext.Provider value={store}>
            {children}
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

    store.setActive("crm-schedule");
    const { result } = renderHook(
      () =>
        useLiveDailySchedule({
          date: "2026-10-17",
          fallbackData: schedulePayload("retained"),
        }),
      { wrapper }
    );

    act(() => store.invalidate("crm-schedule"));
    await waitFor(() => expect(store.getSnapshot("crm-schedule").isRefreshing).toBe(true));
    act(() => store.invalidate("crm-schedule"));

    first.resolve(
      new Response(JSON.stringify(schedulePayload("stale")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(result.current.data?.branchName).toBe("retained");

    second.resolve(
      new Response(JSON.stringify(schedulePayload("latest")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.data?.branchName).toBe("latest"));
    expect(result.current.generation.isDirty).toBe(false);
  });
});
