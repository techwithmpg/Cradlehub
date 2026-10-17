/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { CrmBookingsView } from "@/components/features/bookings/crm-bookings-view";
import type { CrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";

vi.mock("server-only", () => ({}));

const routerRefreshMock = vi.fn();
const routerPushMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => "/crm/bookings",
}));

vi.mock("@/components/features/crm/master-sheet/use-sheet-native-references", () => ({
  useSheetNativeReferences: vi.fn(() => ({
    state: { status: "unavailable" },
    isLoading: false,
    isRefreshing: false,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  useAdministrativeBookingModal: () => ({ openBookingModal: vi.fn() }),
}));

type RefreshActionFn = (params?: {
  date?: string;
  upcoming?: boolean;
  bookingId?: string;
}) => Promise<CrmBookingsOperationalData>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function makeBookingsOperationalData(
  bookings: Partial<WorkspaceBookingRow>[] = [],
  overrides?: Partial<CrmBookingsOperationalData>
): CrmBookingsOperationalData {
  return {
    branchId: "branch-a",
    branchName: "Main Branch",
    role: "crm",
    date: "2026-10-13",
    businessDate: "2026-10-13",
    selectedOutsideWindow: false,
    bookings: bookings.map((b, i) => ({
      id: b.id ?? `b-${i + 1}`,
      order_id: b.order_id ?? `ord-${i + 1}`,
      attendee_id: b.attendee_id ?? `att-${i + 1}`,
      branch_id: "branch-a",
      booking_date: "2026-10-13",
      start_time: "10:00:00",
      end_time: "11:00:00",
      status: b.status ?? "confirmed",
      type: "online",
      delivery_type: "in_spa",
      payment_method: "pay_on_site",
      payment_status: "paid",
      amount_paid: 1000,
      order_payment_status: b.order_payment_status ?? "paid",
      order_amount_paid: b.order_amount_paid ?? 1000,
      order_total_amount: b.order_total_amount ?? 1000,
      customers: {
        id: `c-${i + 1}`,
        full_name: `Customer ${i + 1}`,
        phone: "1234567890",
      },
      services: {
        id: `s-${i + 1}`,
        name: `Service ${i + 1}`,
        duration_minutes: 60,
      },
      staff: {
        id: `st-${i + 1}`,
        full_name: `Therapist ${i + 1}`,
      },
      metadata: {},
      ...b,
    })) as WorkspaceBookingRow[],
    waitlistRows: [],
    cashSummary: null,
    ...overrides,
  };
}

describe("CrmBookingsView generation-aware operational lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = "";
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  async function renderView(options?: {
    initialData?: CrmBookingsOperationalData;
    refreshAction?: RefreshActionFn;
    store?: ReturnType<typeof createWorkspaceGenerationStore>;
    scopeKey?: string;
    active?: boolean;
    cache?: Map<string, unknown>;
  }) {
    const store = options?.store ?? createWorkspaceGenerationStore();
    if (options?.active === false) {
      store.setActive(null);
    } else {
      store.setActive("crm-bookings");
    }
    const cache = options?.cache ?? new Map();
    const refreshAction =
      options?.refreshAction ??
      vi.fn(async () => makeBookingsOperationalData());
    const initialData =
      options?.initialData ??
      makeBookingsOperationalData([
        { id: "b-1", customers: { id: "c-1", full_name: "Alice Smith", phone: "111" } },
      ]);
    const scopeKey = options?.scopeKey ?? "user-1:crm:branch-a:crm-bookings";

    const utils = render(
      <SWRConfig value={{ provider: () => cache }}>
        <WorkspaceSWRScopeContext.Provider value={scopeKey}>
          <WorkspaceGenerationContext.Provider value={store}>
            <CrmBookingsView
              initialData={initialData}
              refreshAction={refreshAction}
            />
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

    // Wait for client viewport check to transition from skeleton to desktop workspace
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading bookings workspace")).toBeNull();
    });

    return { ...utils, store, refreshAction, initialData, cache };
  }

  it("1. cold render: initial Bookings payload causes no immediate duplicate fetch", async () => {
    const { refreshAction } = await renderView();

    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    expect(refreshAction).not.toHaveBeenCalled();
  });

  it("2. active dirty: invalidation triggers exactly one background reconciliation", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const { store } = await renderView({ refreshAction });

    // Mark crm-bookings dirty while active
    act(() => {
      store.invalidate("crm-bookings");
    });

    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    // Initial data remains visible during reconciliation
    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);

    // Resolve reconciliation with updated data
    const updated = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Alice Updated", phone: "111" } },
    ]);
    await act(async () => {
      d.resolve(updated);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Alice Updated").length).toBeGreaterThan(0);
    });
  });

  it("3. hidden dirty: invalidation causes ZERO network requests while hidden", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store, active: false });

    // Invalidate while hidden
    act(() => {
      store.invalidate("crm-bookings");
    });

    expect(store.getSnapshot("crm-bookings").isDirty).toBe(true);
    expect(refreshAction).not.toHaveBeenCalled();
  });

  it("4. reactivation: reveals retained Bookings immediately then reconciles dirty state", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store, active: false });

    // Invalidate while hidden
    act(() => {
      store.invalidate("crm-bookings");
    });
    expect(refreshAction).not.toHaveBeenCalled();

    // Reactivate
    act(() => {
      store.setActive("crm-bookings");
    });

    // Validated retained data is visible immediately
    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);

    // Exactly one reconciliation launched
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    // Complete reconciliation
    const reconciled = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Alice Reconciled", phone: "111" } },
    ]);
    await act(async () => {
      d.resolve(reconciled);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Alice Reconciled").length).toBeGreaterThan(0);
    });
  });

  it("5. stale response cannot overwrite newer generation", async () => {
    const g1 = deferred<CrmBookingsOperationalData>();
    const g2 = deferred<CrmBookingsOperationalData>();
    let callCount = 0;
    const refreshAction = vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? g1.promise : g2.promise;
    });
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store });

    // First invalidation G1
    act(() => {
      store.invalidate("crm-bookings");
    });
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    // Second invalidation G2 while G1 in flight
    act(() => {
      store.invalidate("crm-bookings");
    });

    // G1 finishes late with older state
    const staleData = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Stale Alice", phone: "111" } },
    ]);
    await act(async () => {
      g1.resolve(staleData);
    });

    // Stale data must NOT overwrite
    expect(screen.queryAllByText("Stale Alice")).toHaveLength(0);

    // G2 starts after G1 finishes or finishes in turn
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(2));

    // Now G2 finishes with fresh state
    const freshData = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Fresh Alice", phone: "111" } },
    ]);
    await act(async () => {
      g2.resolve(freshData);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Fresh Alice").length).toBeGreaterThan(0);
    });
  });

  it("6. failed refresh retains validated Bookings and retry recovers", async () => {
    const dFail = deferred<CrmBookingsOperationalData>();
    const dSuccess = deferred<CrmBookingsOperationalData>();
    let attempt = 0;
    const refreshAction = vi.fn().mockImplementation(() => {
      attempt++;
      return attempt === 1 ? dFail.promise : dSuccess.promise;
    });
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store });

    // Trigger reconciliation that fails
    act(() => {
      store.invalidate("crm-bookings");
    });

    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    await act(async () => {
      dFail.reject(new Error("Network disconnect"));
    });

    // Validated data is retained
    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);

    // Error UI with retry button is visible
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Bookings could not refresh. Showing the last loaded data.")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeTruthy();

    // Click retry
    fireEvent.click(retryButton);
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(2));

    // Resolve retry
    const recovered = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Alice Recovered", phone: "111" } },
    ]);
    await act(async () => {
      dSuccess.resolve(recovered);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Alice Recovered").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("7. manual Refresh uses scoped revalidation without route remount", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    await renderView({ refreshAction });

    // Find and click the Refresh button in Bookings workspace
    const refreshButtons = screen.getAllByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshButtons[0]!);

    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));
    expect(routerRefreshMock).not.toHaveBeenCalled();

    await act(async () => {
      d.resolve(
        makeBookingsOperationalData([
          { id: "b-1", customers: { id: "c-1", full_name: "Alice Refreshed", phone: "111" } },
        ])
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Alice Refreshed").length).toBeGreaterThan(0);
    });
  });

  it("8. local desktop filter changes do not trigger server fetch when dataset unchanged", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const initialData = makeBookingsOperationalData([
      {
        id: "b-1",
        status: "confirmed",
        customers: { id: "c-1", full_name: "Alice Attention", phone: "111" },
        staff: null,
      },
    ]);
    await renderView({ refreshAction, initialData });

    expect(screen.getAllByText("Alice Attention").length).toBeGreaterThan(0);
    expect(refreshAction).not.toHaveBeenCalled();

    // Click "Needs attention" quick filter
    const needsAttentionButton = screen.getByRole("button", { name: /Needs attention/i });
    fireEvent.click(needsAttentionButton);

    // Zero server fetch launched for local filter change!
    expect(refreshAction).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();
    expect(screen.getAllByText("Alice Attention").length).toBeGreaterThan(0);
  });

  it("9. selection survival: selected group and line survive background reconciliation", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const initialData = makeBookingsOperationalData([
      { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Stable", phone: "111" } },
      { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Second", phone: "222" } },
    ]);
    const { store } = await renderView({ refreshAction, initialData });

    // Verify Bob is rendered in the list
    expect(screen.getAllByText("Bob Second").length).toBeGreaterThan(0);

    // Select Bob's row
    const bobRow = screen.getByRole("row", { name: /Bob Second/i });
    fireEvent.click(bobRow);

    // Trigger reconciliation with updated customer name
    act(() => {
      store.invalidate("crm-bookings");
    });

    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    await act(async () => {
      d.resolve(
        makeBookingsOperationalData([
          { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Stable", phone: "111" } },
          { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Second (Updated)", phone: "222" } },
        ])
      );
    });

    // Bob Second remains selected in the command pane / details
    await waitFor(() => {
      expect(screen.getAllByText("Bob Second (Updated)").length).toBeGreaterThan(0);
    });
    const updatedBobRow = screen.getByRole("row", { name: /Bob Second \(Updated\)/i });
    expect(updatedBobRow.getAttribute("aria-selected")).toBe("true");
  });

  it("10. selected booking disappearance degrades safely without error", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const initialData = makeBookingsOperationalData([
      { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice First", phone: "111" } },
      { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob ToDisappear", phone: "222" } },
    ]);
    const { store } = await renderView({ refreshAction, initialData });

    // Select Bob
    const bobRow = screen.getByRole("row", { name: /Bob ToDisappear/i });
    fireEvent.click(bobRow);

    // Invalidation where Bob is completed/removed from active list
    act(() => {
      store.invalidate("crm-bookings");
    });

    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    await act(async () => {
      d.resolve(
        makeBookingsOperationalData([
          { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice First", phone: "111" } },
        ])
      );
    });

    // Bob is gone, selection falls back safely to Alice without crash
    await waitFor(() => {
      expect(screen.getAllByText("Alice First").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText("Bob ToDisappear")).toHaveLength(0);
  });

  it("11. cache isolation: different branch/user scope does not share SWR data", async () => {
    const store = createWorkspaceGenerationStore();
    const initialA = makeBookingsOperationalData([
      { id: "b-a", customers: { id: "c-a", full_name: "Branch A Booking", phone: "1" } },
    ], { branchId: "branch-a" });

    const initialB = makeBookingsOperationalData([
      { id: "b-b", customers: { id: "c-b", full_name: "Branch B Booking", phone: "2" } },
    ], { branchId: "branch-b" });

    // Render Branch A
    const viewA = await renderView({
      initialData: initialA,
      store,
      scopeKey: "user-1:crm:branch-a:crm-bookings",
    });
    expect(screen.getAllByText("Branch A Booking").length).toBeGreaterThan(0);
    viewA.unmount();

    // Render Branch B with different scope key
    await renderView({
      initialData: initialB,
      store,
      scopeKey: "user-1:crm:branch-b:crm-bookings",
    });
    expect(screen.getAllByText("Branch B Booking").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Branch A Booking")).toHaveLength(0);
  });

  it("12. upcoming mode changes request identity and fetches multi-day dataset", async () => {
    const refreshAction = vi.fn().mockResolvedValue(
      makeBookingsOperationalData([
        { id: "b-up-1", customers: { id: "c-u1", full_name: "Upcoming Customer", phone: "3" } },
      ])
    );

    const initialData = makeBookingsOperationalData([
      { id: "b-1", customers: { id: "c-1", full_name: "Alice Smith", phone: "111" } },
    ]);

    const { store, rerender, cache } = await renderView({ initialData, refreshAction });

    // Transition searchParams to tab=upcoming
    currentSearch = "tab=upcoming";
    rerender(
      <SWRConfig value={{ provider: () => cache }}>
        <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-a:crm-bookings">
          <WorkspaceGenerationContext.Provider value={store}>
            <CrmBookingsView
              initialData={initialData}
              refreshAction={refreshAction}
            />
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

    // Request key changed from daily to upcoming -> triggers invalidation and reconciliation!
    await waitFor(() => {
      expect(refreshAction).toHaveBeenCalledWith(
        expect.objectContaining({ upcoming: true })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Upcoming Customer").length).toBeGreaterThan(0);
    });
  });

  it("13. deep-link banner is displayed when selectedOutsideWindow is true", async () => {
    const initialData = makeBookingsOperationalData(
      [{ id: "b-far", customers: { id: "c-far", full_name: "Far Future Customer", phone: "4" } }],
      { selectedOutsideWindow: true }
    );
    await renderView({ initialData });

    expect(
      screen.getByText(/The selected booking is beyond the 14-day Upcoming window/i)
    ).toBeTruthy();
  });

  it("14. BOOKINGS_CHANGED_EVENT does not trigger an independent second network path in CrmBookingsView", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store });

    // Dispatch the window event directly
    act(() => {
      window.dispatchEvent(new CustomEvent(BOOKINGS_CHANGED_EVENT, { detail: { bookingId: "b-1" } }));
    });

    // CrmBookingsView no longer has its own window listener calling fetcher directly!
    // Reconciliation only happens if store is invalidated by RetainedWorkspaceProvider.
    expect(refreshAction).not.toHaveBeenCalled();
  });

  it("15. rapid invalidations while in-flight deduplicate into exactly one follow-up reconciliation", async () => {
    const d1 = deferred<CrmBookingsOperationalData>();
    const d2 = deferred<CrmBookingsOperationalData>();
    let calls = 0;
    const refreshAction = vi.fn().mockImplementation(() => {
      calls++;
      return calls === 1 ? d1.promise : d2.promise;
    });
    const store = createWorkspaceGenerationStore();
    await renderView({ refreshAction, store });

    // Invalidation 1
    act(() => {
      store.invalidate("crm-bookings");
    });
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(1));

    // Rapid invalidations while in flight
    act(() => {
      store.invalidate("crm-bookings");
      store.invalidate("crm-bookings");
      store.invalidate("crm-bookings");
    });

    // Still only 1 in flight
    expect(refreshAction).toHaveBeenCalledTimes(1);

    // Resolve first in-flight
    await act(async () => {
      d1.resolve(makeBookingsOperationalData());
    });

    // Store was dirty, so exactly ONE follow-up reconciliation is launched
    await waitFor(() => expect(refreshAction).toHaveBeenCalledTimes(2));

    await act(async () => {
      d2.resolve(
        makeBookingsOperationalData([
          { id: "b-final", customers: { id: "c-f", full_name: "Final Reconciled", phone: "9" } },
        ])
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Final Reconciled").length).toBeGreaterThan(0);
    });
    expect(refreshAction).toHaveBeenCalledTimes(2);
  });
});

