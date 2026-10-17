/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveCrmCustomersData } from "@/components/features/crm/customers/use-live-crm-customers-data";
import { refreshCrmCustomersWorkspaceAction } from "@/lib/actions/crm-customers-data-actions";
import type { CrmCustomersWorkspaceData } from "@/components/features/crm/customers/customer-workspace-data";

vi.mock("@/lib/actions/crm-customers-data-actions", () => ({
  refreshCrmCustomersWorkspaceAction: vi.fn(),
}));

function customersData(
  tab: CrmCustomersWorkspaceData["tab"],
  label: string
): CrmCustomersWorkspaceData {
  const customer = {
    id: `customer-${label}`,
    full_name: label,
    phone: "09170000000",
    email: null,
    total_bookings: tab === "repeat" ? 3 : 1,
    last_booking_date: "2026-10-17",
  };
  return {
    tab,
    page: 1,
    search: undefined,
    allCustomers: tab === "all" ? [customer] : [],
    repeatCustomers: tab === "repeat" ? [customer] : [],
    lapsedCustomers: tab === "lapsed" ? [customer] : [],
    waitlistRows: [],
    kpiData: {
      totalCustomers: tab === "all" ? 1 : 0,
      repeatClients: tab === "repeat" ? 1 : 0,
      lapsedClients: tab === "lapsed" ? 1 : 0,
      newThisMonth: 0,
      totalVisits: customer.total_bookings,
    },
    totalPages: 1,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function wrapperFor(store: ReturnType<typeof createWorkspaceGenerationStore>) {
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
  Wrapper.displayName = "CustomersGenerationTestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(refreshCrmCustomersWorkspaceAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-6 generation-aware CRM Customers reads", () => {
  it("renders the server fallback with zero duplicate initial fetch", () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-customers");
    const fallback = customersData("all", "Initial Customer");

    const { result } = renderHook(
      () =>
        useLiveCrmCustomersData({
          request: { tab: "all", page: 1 },
          fallbackData: fallback,
        }),
      { wrapper: wrapperFor(store) }
    );

    expect(result.current.data?.allCustomers[0]?.full_name).toBe("Initial Customer");
    expect(refreshCrmCustomersWorkspaceAction).not.toHaveBeenCalled();
  });

  it("performs zero canonical reads while hidden, including focus and reconnect events", () => {
    const store = createWorkspaceGenerationStore();
    const fallback = customersData("all", "Retained Customer");

    renderHook(
      () =>
        useLiveCrmCustomersData({
          request: { tab: "all", page: 1 },
          fallbackData: fallback,
        }),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-customers");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refreshCrmCustomersWorkspaceAction).not.toHaveBeenCalled();
    expect(store.getSnapshot("crm-customers").isDirty).toBe(true);
  });

  it("switches request identity without an RSC refresh and reconciles exactly once", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-customers");
    const fallback = customersData("all", "Initial Customer");
    vi.mocked(refreshCrmCustomersWorkspaceAction).mockResolvedValue(
      customersData("repeat", "Repeat Customer")
    );

    const { result, rerender } = renderHook(
      ({ tab }) =>
        useLiveCrmCustomersData({
          request: { tab, page: 1 },
          fallbackData: fallback,
        }),
      {
        initialProps: { tab: "all" as const },
        wrapper: wrapperFor(store),
      }
    );

    expect(refreshCrmCustomersWorkspaceAction).not.toHaveBeenCalled();

    rerender({ tab: "repeat" });

    await waitFor(() =>
      expect(refreshCrmCustomersWorkspaceAction).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(result.current.data?.repeatCustomers[0]?.full_name).toBe("Repeat Customer")
    );
    expect(refreshCrmCustomersWorkspaceAction).toHaveBeenCalledWith({
      tab: "repeat",
      page: 1,
      search: undefined,
    });
  });

  it("rejects stale segment responses after a newer generation invalidation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-customers");
    const first = deferred<CrmCustomersWorkspaceData>();
    const second = deferred<CrmCustomersWorkspaceData>();
    vi.mocked(refreshCrmCustomersWorkspaceAction)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const fallback = customersData("all", "Retained Customer");
    const { result } = renderHook(
      () =>
        useLiveCrmCustomersData({
          request: { tab: "all", page: 1 },
          fallbackData: fallback,
        }),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("crm-customers"));
    await waitFor(() =>
      expect(refreshCrmCustomersWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    act(() => store.invalidate("crm-customers"));
    first.resolve(customersData("all", "STALE Customer"));

    await waitFor(() =>
      expect(refreshCrmCustomersWorkspaceAction).toHaveBeenCalledTimes(2)
    );
    expect(result.current.data?.allCustomers[0]?.full_name).toBe("Retained Customer");

    second.resolve(customersData("all", "Fresh Customer"));
    await waitFor(() =>
      expect(result.current.data?.allCustomers[0]?.full_name).toBe("Fresh Customer")
    );
    expect(store.getSnapshot("crm-customers").isDirty).toBe(false);
  });
});
