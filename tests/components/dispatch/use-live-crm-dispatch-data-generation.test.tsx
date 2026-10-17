/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import {
  WorkspaceGenerationContext,
} from "@/components/features/dashboard/use-workspace-generation";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveCrmDispatchData } from "@/components/features/dispatch/use-live-crm-dispatch-data";

vi.mock("@/lib/actions/dispatch-data-actions", () => ({
  refreshDispatchDataAction: vi.fn(),
}));

function dispatchPayload(label: string): DispatchData {
  return {
    today: "2026-10-17",
    items: [],
    alerts: [
      {
        id: label,
        title: label,
        description: label,
        timeAgo: "now",
        severity: "warning",
        dispatchNumber: "DSP-1",
        bookingId: "booking-1",
      },
    ],
    stats: {
      totalToday: 0,
      awaitingDispatch: 0,
      activeTrips: 0,
      completedToday: 0,
      cancelledToday: 0,
    },
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
      <WorkspaceSWRScopeContext.Provider value="user-a:crm:branch-1">
        <WorkspaceGenerationContext.Provider value={store}>
          {children}
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
  Wrapper.displayName = "DispatchGenerationTestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(refreshDispatchDataAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-5 generation-aware CRM Dispatch reads", () => {
  it("keeps retained data visible and performs zero hidden canonical reads", async () => {
    const store = createWorkspaceGenerationStore();
    const response = deferred<Awaited<ReturnType<typeof refreshDispatchDataAction>>>();
    vi.mocked(refreshDispatchDataAction).mockReturnValue(response.promise);

    const fallback = dispatchPayload("retained");
    const { result } = renderHook(
      () =>
        useLiveCrmDispatchData({
          date: "2026-10-17",
          upcoming: false,
          fallbackData: fallback,
        }),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-dispatch");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refreshDispatchDataAction).not.toHaveBeenCalled();
    expect(result.current.data?.alerts[0]?.title).toBe("retained");

    act(() => store.setActive("crm-dispatch"));
    await waitFor(() => expect(refreshDispatchDataAction).toHaveBeenCalledTimes(1));

    response.resolve({ success: true, data: dispatchPayload("server") });
    await waitFor(() => expect(result.current.data?.alerts[0]?.title).toBe("server"));
    expect(result.current.generation.isDirty).toBe(false);
  });

  it("rejects a stale response and validates the newer generation", async () => {
    const store = createWorkspaceGenerationStore();
    const first = deferred<Awaited<ReturnType<typeof refreshDispatchDataAction>>>();
    const second = deferred<Awaited<ReturnType<typeof refreshDispatchDataAction>>>();
    vi.mocked(refreshDispatchDataAction)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    store.setActive("crm-dispatch");
    const { result } = renderHook(
      () =>
        useLiveCrmDispatchData({
          date: "2026-10-17",
          upcoming: false,
          fallbackData: dispatchPayload("retained"),
        }),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("crm-dispatch"));
    await waitFor(() => expect(refreshDispatchDataAction).toHaveBeenCalledTimes(1));
    act(() => store.invalidate("crm-dispatch"));

    first.resolve({ success: true, data: dispatchPayload("stale") });
    await waitFor(() => expect(refreshDispatchDataAction).toHaveBeenCalledTimes(2));
    expect(result.current.data?.alerts[0]?.title).toBe("retained");

    second.resolve({ success: true, data: dispatchPayload("latest") });
    await waitFor(() => expect(result.current.data?.alerts[0]?.title).toBe("latest"));
    expect(result.current.generation.isDirty).toBe(false);
  });

  it("performs one exact authoritative inclusion read for an unloaded deep link", async () => {
    vi.mocked(refreshDispatchDataAction)
      .mockResolvedValueOnce({ success: true, data: dispatchPayload("list") })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...dispatchPayload("exact"),
          items: [
            {
              id: "booking-42",
              number: "BKG-42",
              bookingDate: "2026-10-18",
              startTime: "09:00",
              endTime: "10:00",
              customerName: "Customer",
              serviceName: "Massage",
              area: null,
              formattedAddress: null,
              lat: null,
              lng: null,
              branchName: "Main",
              branchLat: null,
              branchLng: null,
              needsLocationReview: true,
              driverId: null,
              driverName: null,
              therapistId: "staff-1",
              therapistName: "Therapist",
              dispatchStatus: "awaiting_driver",
              bookingStatus: "confirmed",
              bookingProgressStatus: "confirmed",
              paymentStatus: "unpaid",
              etaMinutes: null,
              travelStartedAt: null,
              arrivedAt: null,
              sessionStartedAt: null,
              completedAt: null,
              rating: null,
              currentLocation: null,
            },
          ],
        },
      });

    const store = createWorkspaceGenerationStore();
    store.setActive("crm-dispatch");
    const { result } = renderHook(
      () =>
        useLiveCrmDispatchData({
          date: "2026-10-17",
          upcoming: true,
          selectedBookingId: "booking-42",
          fallbackData: dispatchPayload("retained"),
        }),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("crm-dispatch"));
    await waitFor(() => expect(refreshDispatchDataAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe("booking-42"));

    expect(refreshDispatchDataAction).toHaveBeenNthCalledWith(1, "2026-10-17", {
      upcoming: true,
    });
    expect(refreshDispatchDataAction).toHaveBeenNthCalledWith(2, "2026-10-17", {
      bookingId: "booking-42",
    });
  });
});
