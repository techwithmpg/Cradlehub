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
import {
  RetainedWorkspaceModule,
  RetainedWorkspaceProvider,
} from "@/components/features/dashboard/retained-workspace-provider";

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
  OpenAdministrativeBookingButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
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
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    };
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

    const rerenderWithSearch = (newSearch: string) => {
      currentSearch = newSearch;
      return utils.rerender(
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
    };

    return { ...utils, rerenderWithSearch, store, refreshAction, initialData, cache };
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

  async function renderWithRetainedProvider(options?: {
    initialData?: CrmBookingsOperationalData;
    refreshAction?: RefreshActionFn;
    paymentAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
    isMobile?: boolean;
  }) {
    if (options?.isMobile) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
    const cache = new Map();
    const refreshAction =
      options?.refreshAction ??
      vi.fn(async () => makeBookingsOperationalData());
    const initialData =
      options?.initialData ??
      makeBookingsOperationalData([
        {
          id: "b-1",
          order_id: null,
          status: "confirmed",
          payment_status: "unpaid",
          amount_paid: 0,
          metadata: { price_paid: 1500 },
          customers: { id: "c-1", full_name: "Alice Unpaid", phone: "111" },
        },
      ]);
    const paymentAction =
      options?.paymentAction ?? vi.fn(async () => ({ success: true }));

    const utils = render(
      <SWRConfig value={{ provider: () => cache }}>
        <RetainedWorkspaceProvider
          workspace="crm"
          userId="user-1"
          role="crm"
          branchId="branch-a"
          enabled
        >
          <RetainedWorkspaceModule moduleId="crm-bookings">
            <CrmBookingsView
              initialData={initialData}
              refreshAction={refreshAction}
              paymentAction={paymentAction}
            />
          </RetainedWorkspaceModule>
        </RetainedWorkspaceProvider>
      </SWRConfig>
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading bookings workspace")).toBeNull();
    });

    return { ...utils, refreshAction, paymentAction, initialData, cache };
  }

  it("16. integration: successful payment through PaymentActionMenu triggers exactly one authoritative Bookings reconciliation", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const paymentAction = vi.fn().mockResolvedValue({ success: true });

    await renderWithRetainedProvider({ refreshAction, paymentAction });

    // Initial render causes zero fetch
    expect(refreshAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Alice Unpaid").length).toBeGreaterThan(0);

    // Click the Manage payment trigger in SelectedBookingPaymentRow to open quick pay menu
    const payTrigger = screen.getByRole("button", { name: /Manage/i });
    fireEvent.click(payTrigger);

    // Click Cash quick pay option
    const cashOption = screen.getByRole("button", { name: "Cash" });
    fireEvent.click(cashOption);

    // Wait for paymentAction to be called
    await waitFor(() => {
      expect(paymentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "b-1",
          paymentMethod: "cash",
          paymentStatus: "paid",
        })
      );
    });

    // Successful payment emits notifyBookingsChanged -> RetainedWorkspaceProvider invalidates crm-bookings -> exactly ONE reconciliation!
    await waitFor(() => {
      expect(refreshAction).toHaveBeenCalledTimes(1);
    });

    // Data remains visible while reconciliation is in flight
    expect(screen.getAllByText("Alice Unpaid").length).toBeGreaterThan(0);

    // Resolve authoritative fresh payload with paid status
    await act(async () => {
      d.resolve(
        makeBookingsOperationalData([
          {
            id: "b-1",
            order_id: null,
            status: "confirmed",
            payment_status: "paid",
            amount_paid: 1500,
            metadata: { price_paid: 1500 },
            customers: { id: "c-1", full_name: "Alice Paid Authoritative", phone: "111" },
          },
        ])
      );
    });

    // Authoritative data is rendered and still exactly 1 reconciliation was made (never duplicate 2)
    await waitFor(() => {
      expect(screen.getAllByText("Alice Paid Authoritative").length).toBeGreaterThan(0);
    });
    expect(refreshAction).toHaveBeenCalledTimes(1);
  });

  it("17. integration: failed payment triggers zero false state updates and zero reconciliations", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const paymentAction = vi.fn().mockResolvedValue({
      success: false,
      error: "Card declined by terminal",
    });

    await renderWithRetainedProvider({ refreshAction, paymentAction });

    expect(screen.getAllByText("Alice Unpaid").length).toBeGreaterThan(0);
    expect(refreshAction).not.toHaveBeenCalled();

    // Click Manage payment trigger
    const payTrigger = screen.getByRole("button", { name: /Manage/i });
    fireEvent.click(payTrigger);

    // Click Card quick pay option
    const cardOption = screen.getByRole("button", { name: "Card" });
    fireEvent.click(cardOption);

    await waitFor(() => {
      expect(paymentAction).toHaveBeenCalledTimes(1);
    });

    // Feedback error is shown in the UI
    await waitFor(() => {
      expect(screen.getByText("Card declined by terminal")).toBeTruthy();
    });

    // Zero reconciliations triggered!
    expect(refreshAction).not.toHaveBeenCalled();

    // Alice Unpaid is still displayed, unchanged
    expect(screen.getAllByText("Alice Unpaid").length).toBeGreaterThan(0);
  });

  it("18. integration: mobile table payment confirmation triggers exactly one authoritative Bookings reconciliation", async () => {
    const d = deferred<CrmBookingsOperationalData>();
    const refreshAction = vi.fn().mockReturnValue(d.promise);
    const paymentAction = vi.fn().mockResolvedValue({ success: true });

    await renderWithRetainedProvider({ refreshAction, paymentAction, isMobile: true });

    expect(refreshAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Alice Unpaid").length).toBeGreaterThan(0);

    // In mobile table, PrimaryRowAction renders Review Payment trigger
    const payTrigger = screen.getByRole("button", { name: /Review Payment/i });
    fireEvent.click(payTrigger);

    // Click Cash quick pay
    const cashOption = screen.getByRole("button", { name: "Cash" });
    fireEvent.click(cashOption);

    await waitFor(() => {
      expect(paymentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "b-1",
          paymentMethod: "cash",
          paymentStatus: "paid",
        })
      );
    });

    // Exactly one reconciliation triggered via RetainedWorkspaceProvider
    await waitFor(() => {
      expect(refreshAction).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      d.resolve(
        makeBookingsOperationalData([
          {
            id: "b-1",
            order_id: null,
            status: "confirmed",
            payment_status: "paid",
            amount_paid: 1500,
            metadata: { price_paid: 1500 },
            customers: { id: "c-1", full_name: "Alice Paid Mobile", phone: "111" },
          },
        ])
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Alice Paid Mobile").length).toBeGreaterThan(0);
    });
    expect(refreshAction).toHaveBeenCalledTimes(1);
  });

  it("19. selection change inside loaded dataset triggers zero authoritative reads across A -> B -> A with searchParams synchronization", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const initialData = makeBookingsOperationalData([
      { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Alpha", phone: "111" } },
      { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Beta", phone: "222" } },
    ]);

    const { rerenderWithSearch } = await renderView({ refreshAction, initialData });

    // Initial load: 0 network requests
    expect(refreshAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Alice Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob Beta").length).toBeGreaterThan(0);

    // 1. Select Bob Beta
    const bobRow = screen.getByRole("row", { name: /Bob Beta/i });
    fireEvent.click(bobRow);

    // Verify Bob is selected in DOM
    expect(bobRow.getAttribute("aria-selected")).toBe("true");

    // Simulate Next.js 16 native history update: useSearchParams now returns bookingId=b-2
    rerenderWithSearch("?bookingId=b-2");

    // Assert: Bob remains selected
    const bobRowAfterRerender = screen.getByRole("row", { name: /Bob Beta/i });
    expect(bobRowAfterRerender.getAttribute("aria-selected")).toBe("true");
    // Assert: refreshAction call count remains 0!
    expect(refreshAction).not.toHaveBeenCalled();

    // 2. Select Alice Alpha
    const aliceRow = screen.getByRole("row", { name: /Alice Alpha/i });
    fireEvent.click(aliceRow);

    expect(aliceRow.getAttribute("aria-selected")).toBe("true");

    // Simulate Next.js update: searchParams now returns bookingId=b-1
    rerenderWithSearch("?bookingId=b-1");

    // Assert: Alice remains selected
    const aliceRowAfterRerender = screen.getByRole("row", { name: /Alice Alpha/i });
    expect(aliceRowAfterRerender.getAttribute("aria-selected")).toBe("true");
    // Assert: refreshAction call count remains 0!
    expect(refreshAction).not.toHaveBeenCalled();

    // 3. Select Bob Beta again (A -> B -> A cycle)
    const bobRowSecondTime = screen.getByRole("row", { name: /Bob Beta/i });
    fireEvent.click(bobRowSecondTime);

    rerenderWithSearch("?bookingId=b-2");

    const finalBobRow = screen.getByRole("row", { name: /Bob Beta/i });
    expect(finalBobRow.getAttribute("aria-selected")).toBe("true");

    // TOTAL AUTHORITATIVE READS ACROSS ENTIRE CYCLE = ZERO!
    expect(refreshAction).not.toHaveBeenCalled();
  });

  it("20. direct/deep-link to an unloaded bookingId triggers authoritative inclusion reconciliation", async () => {
    const refreshAction = vi.fn().mockResolvedValue(
      makeBookingsOperationalData([
        { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Alpha", phone: "111" } },
        { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Beta", phone: "222" } },
        { id: "b-unloaded", order_id: "ord-3", customers: { id: "c-3", full_name: "Charlie Unloaded", phone: "333" } },
      ])
    );
    const initialData = makeBookingsOperationalData([
      { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Alpha", phone: "111" } },
      { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Beta", phone: "222" } },
    ]);

    const { rerenderWithSearch } = await renderView({ refreshAction, initialData });

    expect(refreshAction).not.toHaveBeenCalled();

    // Deep-link navigation to unloaded booking "b-unloaded"
    rerenderWithSearch("?bookingId=b-unloaded");

    // Authoritative inclusion fetch is launched for b-unloaded
    await waitFor(() => {
      expect(refreshAction).toHaveBeenCalledTimes(1);
      expect(refreshAction).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "b-unloaded",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Charlie Unloaded").length).toBeGreaterThan(0);
    });

    // Exactly 1 fetch total
    expect(refreshAction).toHaveBeenCalledTimes(1);
  });

  it("21. workspace and modal state survive row selection and searchParams updates without remounting", async () => {
    const refreshAction = vi.fn().mockResolvedValue(makeBookingsOperationalData());
    const initialData = makeBookingsOperationalData([
      { id: "b-1", order_id: "ord-1", customers: { id: "c-1", full_name: "Alice Alpha", phone: "111" } },
      { id: "b-2", order_id: "ord-2", customers: { id: "c-2", full_name: "Bob Beta", phone: "222" } },
    ]);

    const { rerenderWithSearch } = await renderView({ refreshAction, initialData });

    // Open Reschedule modal from quick actions for the currently selected booking
    const rescheduleButton = screen.getByRole("button", { name: /Reschedule/i });
    fireEvent.click(rescheduleButton);

    // Verify modal is open in DOM
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Reschedule Booking")).toBeTruthy();

    // Simulate searchParams update (e.g. user selected Bob)
    rerenderWithSearch("?bookingId=b-2");

    // Assert: Modal is NOT destroyed because workspace did not remount!
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Reschedule Booking")).toBeTruthy();

    // Zero network requests
    expect(refreshAction).not.toHaveBeenCalled();
  });
});

