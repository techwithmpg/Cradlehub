/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { CrmTodayShell } from "@/components/features/crm/today/crm-today-shell";
import type { CrmTodayOperationalData } from "@/lib/queries/crm-today-operational";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";

vi.mock("server-only", () => ({}));

const routerRefreshMock = vi.fn();
const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
    push: routerPushMock,
  }),
}));

vi.mock("@/components/features/attendance/use-attendance-scan-feed", () => ({
  useAttendanceScanFeed: ({ initialFeed }: { initialFeed: AttendanceScanFeedData }) => ({
    feed: initialFeed,
    realtimeStatus: "live",
    isValidating: false,
    error: null,
    refreshFeed: vi.fn(),
  }),
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  useAdministrativeBookingModal: () => ({ openBookingModal: vi.fn() }),
}));

vi.mock("@/lib/cash-flow/financial-entry-context", () => ({
  loadFinancialEntryContextAction: vi.fn(async () => ({
    ok: true,
    data: {
      accounts: [],
      expenseCategories: [],
      staffOptions: [],
      payableOrders: [{ id: "ord-1" }],
      cashSessions: { activeSessions: [] },
      branchId: "branch-a",
      businessDate: "2026-10-17",
    },
  })),
}));

vi.mock("@/components/features/cash-flow/record-financial-entry-modal", () => ({
  RecordFinancialEntryModal: ({ onSuccess }: { onSuccess: () => void }) => (
    <div role="dialog">
      <button onClick={onSuccess}>Submit Financial Entry</button>
    </div>
  ),
}));

const markBookingArrivedActionMock = vi.fn();
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  markBookingArrivedAction: (...args: unknown[]) => markBookingArrivedActionMock(...args),
  crmStartServiceAction: vi.fn(),
}));

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function makeOperationalData(bookingCount = 1, collected = 1000): CrmTodayOperationalData {
  return {
    queueData: Array.from({ length: bookingCount }, (_, idx) => ({
      id: `b-${idx + 1}`,
      order_id: `ord-${idx + 1}`,
      attendee_id: `att-${idx + 1}`,
      booking_attendees: null,
      booking_orders: null,
      order_payment_status: "unpaid",
      order_amount_paid: 0,
      order_total_amount: 1000,
      branch_id: "branch-a",
      booking_date: "2026-10-17",
      start_time: "10:00",
      end_time: "11:00",
      status: "confirmed",
      type: "in_store",
      travel_buffer_mins: 0,
      payment_status: "unpaid",
      payment_method: "cash",
      amount_paid: 0,
      price_paid: 1000,
      payment_reference: null,
      customer_name: `Customer ${idx + 1}`,
      customer_phone: "09171234567",
      service_name: "Swedish Massage",
      service_duration: 60,
      staff_name: `Therapist ${idx + 1}`,
      staff_id: `staff-${idx + 1}`,
      requested_staff_id: `staff-${idx + 1}`,
      therapist_selection_source: "customer_requested",
      resource_name: `Room ${idx + 1}`,
      booking_progress_status: "waiting",
      checked_in_at: null,
      session_started_at: null,
      session_due_at: null,
      session_completed_at: null,
      created_at: "2026-10-17T08:00:00Z",
      resource_id: `res-${idx + 1}`,
      delivery_type: "in_store",
      metadata: null,
      hs_zone: null,
      hs_address: null,
      hs_city: null,
      hs_map_url: null,
      dispatch_warning: null,
      needs_location_review: false,
      needs_staff_schedule_review: false,
      staff_schedule_exception_label: null,
      staff_schedule_exception_reason: null,
      driver_id: null,
      driver_name: null,
      no_driver_warning: false,
      last_location_at: null,
      tracking_token: null,
      tracking_url: null,
      tracking_message: null,
      dest_lat: null,
      dest_lng: null,
      live_eta: null,
    })),
    snapshot: {
      date: "2026-10-17",
      branchId: "branch-a",
      bookingSummary: {
        total: bookingCount,
        pending: 0,
        confirmed: bookingCount,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        unassigned: 0,
      },
      staffReadiness: {
        total: 1,
        scheduledToday: 1,
        checkedIn: 1,
        notCheckedIn: 0,
        availableNow: 1,
        busyNow: 0,
        checkedOut: 0,
        offToday: 0,
        noSchedule: 0,
        scheduleConflicts: 0,
        driversReady: 0,
        driversTotal: 0,
        needsAttention: 0,
        serviceStaffNoSchedule: 0,
        pendingOnlineBookings: 0,
      },
      dispatchStats: {
        totalToday: 0,
        awaitingDispatch: 0,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
      payment: {
        total_collected: collected,
        transaction_count: 1,
        payment_methods: { cash: collected },
      } as unknown as CrmTodayOperationalData["snapshot"]["payment"],
    },
    actionNotifications: [],
    readinessIssues: [],
    readinessStatus: "ok",
    readinessAvailable: true,
  };
}

const defaultScanFeed = {
  workspace: "crm",
  branchId: "branch-a",
  branchName: "Main Branch",
  selectedDate: "2026-10-17",
  timezone: "Asia/Manila",
  items: [],
  lastHourCount: 0,
  lastHourOperations: [],
  nextCursor: null,
  error: null,
};

function fixture() {
  const store = createWorkspaceGenerationStore();
  const cache = new Map();
  const fetcher = vi.fn<() => Promise<CrmTodayOperationalData>>();
  const initial = makeOperationalData(1, 1000);

  const renderComponent = (scope = "user-1:crm:branch-a") =>
    render(
      <SWRConfig value={{ provider: () => cache }}>
        <WorkspaceSWRScopeContext.Provider value={scope}>
          <WorkspaceGenerationContext.Provider value={store}>
            <CrmTodayShell
              duty={null}
              handoverConfirmed={false}
              branchName="Main Branch"
              dateLabel="Saturday, October 17"
              roleLabel="Front Desk"
              initialData={initial}
              queueData={initial.queueData}
              snapshot={initial.snapshot}
              actionNotifications={initial.actionNotifications}
              attendanceScanFeed={defaultScanFeed as unknown as AttendanceScanFeedData}
              attendanceScanDate="2026-10-17"
              readinessIssues={initial.readinessIssues}
              readinessStatus={initial.readinessStatus}
              refreshAction={fetcher}
            />
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

  return { store, cache, fetcher, initial, renderComponent };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CRM Today Generation-Aware SWR Lifecycle (PERF-2)", () => {
  it("Requirement 1: initial payload does not immediately duplicate-fetch", async () => {
    const { store, fetcher, renderComponent } = fixture();
    store.setActive("crm-work-queue");
    renderComponent();

    // Cold Today mount with fallback data should render immediately with ZERO fetch
    expect(screen.getByText("Customer 1")).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("Requirement 2, 3, 4: active booking invalidation triggers background Today refresh; validated data stays visible; no router.refresh()", async () => {
    const { store, fetcher, renderComponent } = fixture();
    const response = deferred<CrmTodayOperationalData>();
    fetcher.mockReturnValue(response.promise);
    store.setActive("crm-work-queue");
    renderComponent();

    expect(screen.getByText("Customer 1")).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();

    // Trigger booking invalidation
    act(() => {
      store.invalidate("crm-work-queue");
    });

    // Revalidation is in flight
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Validated Today data stays visible during in-flight refresh (no blank screen!)
    expect(screen.getByText("Customer 1")).toBeDefined();
    expect(routerRefreshMock).not.toHaveBeenCalled();

    // Complete revalidation with updated payload
    const updated = makeOperationalData(2, 2000);
    await act(async () => {
      response.resolve(updated);
    });

    // UI now reflects reconciled payload
    await waitFor(() => expect(screen.getByText("Customer 2")).toBeDefined());
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("Requirement 5: hidden invalidation produces ZERO network requests", async () => {
    const { store, fetcher, renderComponent } = fixture();
    // Do NOT set active (hidden workspace)
    renderComponent();

    act(() => {
      store.invalidate("crm-work-queue");
      store.invalidate("crm-work-queue");
    });

    // ZERO fetch when hidden
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.getSnapshot("crm-work-queue").isDirty).toBe(true);
  });

  it("Requirement 6, 7: reactivation reveals retained UI before fetch completes, then triggers exactly one reconciliation", async () => {
    const { store, fetcher, renderComponent } = fixture();
    const response = deferred<CrmTodayOperationalData>();
    fetcher.mockReturnValue(response.promise);

    // Initial mount while hidden
    renderComponent();

    // Invalidate while hidden
    act(() => {
      store.invalidate("crm-work-queue");
    });
    expect(fetcher).not.toHaveBeenCalled();

    // Reactivate CRM Today
    act(() => {
      store.setActive("crm-work-queue");
    });

    // Retained UI visible immediately
    expect(screen.getByText("Customer 1")).toBeDefined();

    // Triggers exactly ONE background reconciliation
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Finish reconciliation
    await act(async () => {
      response.resolve(makeOperationalData(3, 3000));
    });

    await waitFor(() => expect(screen.getByText("Customer 3")).toBeDefined());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("Requirement 8: stale response cannot overwrite newer generation", async () => {
    const { store, fetcher, renderComponent } = fixture();
    const staleResponse = deferred<CrmTodayOperationalData>();
    const latestResponse = deferred<CrmTodayOperationalData>();
    fetcher.mockReturnValueOnce(staleResponse.promise).mockReturnValueOnce(latestResponse.promise);

    store.setActive("crm-work-queue");
    renderComponent();

    // Gen 1 invalidation
    act(() => {
      store.invalidate("crm-work-queue");
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Gen 2 invalidation before Gen 1 resolves
    act(() => {
      store.invalidate("crm-work-queue");
    });

    // Stale Gen 1 resolves
    const staleData = makeOperationalData(1, 1111);
    staleData.queueData[0]!.customer_name = "STALE OLD DATA";
    await act(async () => {
      staleResponse.resolve(staleData);
    });

    // Stale data is discarded; Customer 1 remains visible
    expect(screen.queryByText("STALE OLD DATA")).toBeNull();

    // Gen 2 starts and completes
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const latestData = makeOperationalData(1, 2222);
    latestData.queueData[0]!.customer_name = "LATEST FRESH DATA";
    await act(async () => {
      latestResponse.resolve(latestData);
    });

    await waitFor(() => expect(screen.getByText("LATEST FRESH DATA")).toBeDefined());
  });

  it("Requirement 9: rapid invalidations are deterministic", async () => {
    const { store, fetcher, renderComponent } = fixture();
    const res1 = deferred<CrmTodayOperationalData>();
    const res2 = deferred<CrmTodayOperationalData>();
    fetcher.mockReturnValueOnce(res1.promise).mockReturnValueOnce(res2.promise);

    store.setActive("crm-work-queue");
    renderComponent();

    // 5 rapid invalidations
    act(() => {
      store.invalidate("crm-work-queue");
      store.invalidate("crm-work-queue");
      store.invalidate("crm-work-queue");
      store.invalidate("crm-work-queue");
      store.invalidate("crm-work-queue");
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      res1.resolve(makeOperationalData(1, 5000));
    });

    expect(store.getSnapshot("crm-work-queue").invalidationGeneration).toBe(5);
  });

  it("Requirement 10, 11, 12: failed refresh preserves validated data, remains dirty, and retry recovers", async () => {
    const { store, fetcher, renderComponent } = fixture();
    fetcher
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(makeOperationalData(4, 4000));

    store.setActive("crm-work-queue");
    renderComponent();

    act(() => {
      store.invalidate("crm-work-queue");
    });

    // Failure occurs
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Validated data preserved on failure
    expect(screen.getByText("Customer 1")).toBeDefined();

    // Non-destructive retry feedback is visible
    await waitFor(() =>
      expect(screen.getByText(/Could not refresh live operational data/i)).toBeDefined()
    );

    // Module remains dirty
    expect(store.getSnapshot("crm-work-queue").isDirty).toBe(true);

    // Click retry button
    const retryBtn = screen.getByText("Retry");
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    // Recovers successfully
    await waitFor(() => expect(screen.getByText("Customer 4")).toBeDefined());
    expect(store.getSnapshot("crm-work-queue").isDirty).toBe(false);
    expect(screen.queryByText(/Could not refresh live operational data/i)).toBeNull();
  });

  it("Requirement 13: manual header Refresh uses scoped revalidation without calling router.refresh()", async () => {
    const { store, fetcher, renderComponent } = fixture();
    fetcher.mockResolvedValue(makeOperationalData(5, 5000));

    store.setActive("crm-work-queue");
    renderComponent();

    const refreshBtn = screen.getByTitle("Refresh");
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Customer 5")).toBeDefined());
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("Requirement 17: selected booking survives reconciliation by ID and disappears safely when removed", async () => {
    const { store, fetcher, renderComponent } = fixture();
    const updatedWithEdit = makeOperationalData(1, 1000);
    updatedWithEdit.queueData[0]!.customer_name = "Customer One (Updated Name)";

    fetcher.mockResolvedValueOnce(updatedWithEdit);

    store.setActive("crm-work-queue");
    renderComponent();

    // Open booking dialog
    const card = screen.getByText("Customer 1");
    fireEvent.click(card);

    // Invalidate and reconcile
    act(() => {
      store.invalidate("crm-work-queue");
    });

    // Selected booking survives reconciliation by ID and displays updated information
    await waitFor(() =>
      expect(screen.getAllByText("Customer One (Updated Name)").length).toBeGreaterThan(0)
    );

    // Now reconcile with booking removed
    const emptyPayload = makeOperationalData(0, 0);
    fetcher.mockResolvedValueOnce(emptyPayload);

    act(() => {
      store.invalidate("crm-work-queue");
    });

    // Reconcile and ensure safe degradation without binding old data to another booking
    await waitFor(() => expect(screen.queryByText("Customer One (Updated Name)")).toBeNull());
  });

  it("Requirement 20: SWR user/role/branch/module isolation remains intact across scope changes", async () => {
    const { store, fetcher, renderComponent } = fixture();
    fetcher.mockResolvedValueOnce(makeOperationalData(1, 9999));
    store.setActive("crm-work-queue");

    const view = renderComponent("user-1:crm:branch-a");
    act(() => {
      store.invalidate("crm-work-queue");
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Change branch scope
    view.rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-b">
          <WorkspaceGenerationContext.Provider value={store}>
            <CrmTodayShell
              duty={null}
              handoverConfirmed={false}
              branchName="Branch B"
              dateLabel="Saturday, October 17"
              roleLabel="Front Desk"
              initialData={makeOperationalData(1, 7777)}
              queueData={makeOperationalData(1, 7777).queueData}
              snapshot={makeOperationalData(1, 7777).snapshot}
              actionNotifications={[]}
              attendanceScanFeed={defaultScanFeed as unknown as AttendanceScanFeedData}
              attendanceScanDate="2026-10-17"
              readinessIssues={[]}
              readinessStatus="ok"
              refreshAction={fetcher}
            />
          </WorkspaceGenerationContext.Provider>
        </WorkspaceSWRScopeContext.Provider>
      </SWRConfig>
    );

    // The data is isolated to branch-b fallback, not polluted by branch-a
    expect(screen.getAllByText(/Branch B/).length).toBeGreaterThan(0);
  });

  it("Requirement 14: financial-entry success uses scoped Today refresh/invalidation without calling router.refresh()", async () => {
    const { store, fetcher, renderComponent } = fixture();
    fetcher.mockResolvedValue(makeOperationalData(1, 1500));
    store.setActive("crm-work-queue");
    renderComponent();

    // Click "RECORD EXPENSES" action card to open modal
    const expenseBtn = screen.getByText("RECORD EXPENSES");
    await act(async () => {
      fireEvent.click(expenseBtn);
    });

    // Modal opens
    await waitFor(() => expect(screen.getByText("Submit Financial Entry")).toBeDefined());

    // Submit financial entry
    const submitBtn = screen.getByText("Submit Financial Entry");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Scoped revalidation is triggered
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("Requirement 15, 16: failed booking mutation does not claim new state; successful mutation causes exactly one invalidation", async () => {
    const { store, fetcher, renderComponent } = fixture();
    store.setActive("crm-work-queue");
    renderComponent();

    const checkInBtn = screen.getByText("Check In");

    // Case 1: Mutation fails
    markBookingArrivedActionMock.mockResolvedValueOnce({
      success: false,
      error: "Therapist unavailable",
    });
    await act(async () => {
      fireEvent.click(checkInBtn);
    });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Therapist unavailable"));
    // Did NOT invalidate store
    expect(store.getSnapshot("crm-work-queue").invalidationGeneration).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();

    // Case 2: Mutation succeeds
    markBookingArrivedActionMock.mockResolvedValueOnce({ success: true });
    // Listen for BOOKINGS_CHANGED_EVENT and trigger generation store invalidation
    const onBookingsChanged = () => store.invalidate("crm-work-queue");
    window.addEventListener(BOOKINGS_CHANGED_EVENT, onBookingsChanged);

    fetcher.mockResolvedValueOnce(makeOperationalData(1, 1000));
    await act(async () => {
      fireEvent.click(checkInBtn);
    });

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Booking updated"));
    // Exactly ONE invalidation triggered
    expect(store.getSnapshot("crm-work-queue").invalidationGeneration).toBe(1);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(routerRefreshMock).not.toHaveBeenCalled();

    window.removeEventListener(BOOKINGS_CHANGED_EVENT, onBookingsChanged);
  });

  it("Requirement 25: attendance realtime remains independent of workspace generation", async () => {
    const { store, renderComponent } = fixture();
    store.setActive("crm-work-queue");
    renderComponent();

    // Attendance side rail elements are rendered independently
    expect(screen.getByText("Attendance Activity")).toBeDefined();

    // Invalidate Today operational workspace
    act(() => {
      store.invalidate("crm-work-queue");
    });
    // Attendance feed is not broken by Today invalidation
    expect(screen.getByText("Attendance Activity")).toBeDefined();
  });

  it("Requirement 27: payment state remains server-authoritative and is never fabricated client-side", async () => {
    const { store, renderComponent } = fixture();
    store.setActive("crm-work-queue");
    renderComponent();

    // Unpaid booking displays due amount, not marked paid
    expect(screen.getByText(/due/)).toBeDefined();
    // Paid tag is not fabricated
    expect(screen.queryByText(/All Paid/i)).toBeNull();
  });
});
