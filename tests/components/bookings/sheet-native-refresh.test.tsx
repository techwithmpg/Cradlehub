/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const swr = vi.hoisted(() => ({ call: vi.fn(), mutate: vi.fn() }));
vi.mock("swr", () => ({ default: (...args: unknown[]) => swr.call(...args) }));

import { useSheetNativeReferences } from "@/components/features/crm/master-sheet/use-sheet-native-references";
import { SheetFreshnessControl } from "@/components/features/bookings/sheet-freshness-control";

afterEach(() => {
  cleanup();
  swr.call.mockReset();
  swr.mutate.mockReset();
});

describe("Master Sheet active read", () => {
  it("polls only while selected and enables focus, reconnect, and manual refresh", () => {
    swr.call.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: swr.mutate,
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useSheetNativeReferences("2026-10-13", enabled, true),
      { initialProps: { enabled: true } }
    );
    const [key, , options] = swr.call.mock.lastCall!;
    expect(key).toBe("/api/crm/master-sheet/references?date=2026-10-13");
    expect(options).toMatchObject({
      refreshInterval: 60_000,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: false,
    });
    result.current.refresh();
    expect(swr.mutate).toHaveBeenCalledOnce();
    rerender({ enabled: false });
    expect(swr.call.mock.lastCall?.[0]).toBeNull();
  });

  it("passes later Sheet results to the view without navigation", () => {
    const first = {
      status: "available",
      observedAt: "2026-10-13T01:00:00Z",
      branchLabel: "Main",
      bookings: [{ id: "first" }],
      payments: [],
    };
    const later = {
      ...first,
      observedAt: "2026-10-13T01:01:00Z",
      bookings: [{ id: "first" }, { id: "later" }],
    };
    swr.call.mockReturnValue({
      data: first,
      isLoading: false,
      isValidating: true,
      mutate: swr.mutate,
    });
    const { result, rerender } = renderHook(() => useSheetNativeReferences("2026-10-13"));
    expect(result.current.state).toEqual(first);
    swr.call.mockReturnValue({
      data: later,
      isLoading: false,
      isValidating: false,
      mutate: swr.mutate,
    });
    rerender();
    expect(result.current.state).toEqual(later);
  });

  it("keeps other Sheet consumers on their existing non-polling behavior", () => {
    swr.call.mockReturnValue({
      data: undefined,
      isLoading: true,
      isValidating: false,
      mutate: swr.mutate,
    });
    renderHook(() => useSheetNativeReferences("2026-10-13"));
    expect(swr.call.mock.lastCall?.[2]).toMatchObject({
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    });
  });

  it("shows the last checked time and allows manual Refresh", () => {
    const refresh = vi.fn();
    render(
      <SheetFreshnessControl
        state={{
          status: "available_empty",
          observedAt: "2026-10-13T01:00:00Z",
          branchLabel: "Main",
          bookings: [],
          payments: [],
        }}
        onRefresh={refresh}
      />
    );
    expect(screen.getByText(/Master Sheet · checked/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
