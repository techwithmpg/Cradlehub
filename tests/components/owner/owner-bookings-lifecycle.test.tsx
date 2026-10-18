/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { OwnerBookingsView } from "@/components/features/bookings/owner-bookings-view";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { OwnerBookingsInitialRead } from "@/lib/owner/owner-bookings-query";

const mock = vi.hoisted(() => ({ get: vi.fn(), change: vi.fn() }));
let search = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/app/(dashboard)/owner/bookings/actions", () => ({
  getOwnerWorkspaceBookingsAction: mock.get,
  ownerUpdateBookingStatusAction: vi.fn(),
  ownerUpdateBookingPaymentAction: vi.fn(),
}));
vi.mock("@/components/features/bookings/bookings-workspace", () => ({
  BookingsWorkspace: ({ bookings, onBookingsChanged, onRefresh, branchFilter, initialTab, initialSelectedId, search: text }: {
    bookings: WorkspaceBookingRow[];
    onBookingsChanged: () => void;
    onRefresh: () => void;
    branchFilter?: string;
    initialTab?: string;
    initialSelectedId?: string;
    search?: string;
  }) => (
    <section>
      <output data-testid="rows">{bookings.map((row) => row.id).join(",") || "empty"}</output>
      <output data-testid="branch">{branchFilter ?? "all"}</output>
      <output data-testid="selection">{initialSelectedId ?? "none"}</output>
      <output data-testid="tab">{initialTab ?? "default"}</output>
      <output data-testid="search">{text ?? "none"}</output>
      <button onClick={onBookingsChanged}>Mutation completed</button>
      <button onClick={onRefresh}>Refresh</button>
    </section>
  ),
}));

function row(id: string): WorkspaceBookingRow {
  return { id } as WorkspaceBookingRow;
}
function ready(id: string): OwnerBookingsInitialRead {
  return { status: "ready", bookings: [row(id)] };
}
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  promise.catch(() => {});
  return { promise, resolve, reject };
}
const props = {
  initialRead: ready("main-1"),
  initialDate: "2026-10-18",
  initialBranch: undefined,
  initialStatus: undefined,
  initialType: undefined,
  branches: [{ id: "main", name: "Main" }, { id: "sm", name: "SM" }],
};
function renderView(options?: {
  store?: ReturnType<typeof createWorkspaceGenerationStore> | null;
  scope?: string;
}) {
  const cache = new Map();
  const store = options?.store ?? null;
  const scope = options?.scope ?? "owner-user:owner:owner:all-branches";
  const content = () => (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value={scope}>
        <WorkspaceGenerationContext.Provider value={store}>
          <OwnerBookingsView {...props} />
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
  const view = render(content());
  const rerender = (nextSearch: string) => {
    search = nextSearch;
    view.rerender(content());
  };
  return { ...view, rerender, cache };
}
beforeEach(() => {
  mock.get.mockReset();
  mock.get.mockResolvedValue({ bookings: [row("updated")] });
  search = "";
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("PERF-9B Owner Bookings lifecycle", () => {
  it("keeps SSR bookings without a duplicate read when Owner retention is OFF", () => {
    renderView();
    expect(screen.getByTestId("rows").textContent).toBe("main-1");
    expect(mock.get).not.toHaveBeenCalled();
  });

  it("retains ordinary SWR behavior and performs one read per legacy mutation signal", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Mutation completed" }));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("updated"));
  });

  it("never displays a server-denied branch as a legitimate empty list", async () => {
    mock.get.mockResolvedValue({ error: "The selected branch is not available from this workspace." });
    search = "branch=not-visible";
    renderView();
    expect(screen.queryByTestId("rows")).toBeNull();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("unavailable"));
    expect(screen.queryByTestId("rows")).toBeNull();
    expect(mock.get).toHaveBeenCalledWith(expect.objectContaining({ branchId: "not-visible" }));
  });

  it("rejects duplicate branch params without reading the first visible branch", () => {
    search = "branch=main&branch=sm";
    renderView();
    expect(screen.getByRole("alert").textContent).toContain("selected branch is not available");
    expect(screen.queryByTestId("rows")).toBeNull();
    expect(mock.get).not.toHaveBeenCalled();
  });

  it("does not expose previous query rows while a new query is loading", async () => {
    const d = pending<{ bookings: WorkspaceBookingRow[] }>();
    mock.get.mockReturnValue(d.promise);
    const view = renderView();
    view.rerender("status=completed");
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("rows")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    await act(async () => d.resolve({ bookings: [row("completed-1")] }));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("completed-1"));
    expect(mock.get).toHaveBeenCalledWith({
      date: "2026-10-18",
      branchId: undefined,
      status: "completed",
      type: undefined,
    });
  });

  it("restores Owner tab, search and booking deep link without changing the server query", () => {
    search = "tab=active&search=alice&bookingId=main-1";
    renderView();
    expect(screen.getByTestId("tab").textContent).toBe("active");
    expect(screen.getByTestId("search").textContent).toBe("alice");
    expect(screen.getByTestId("selection").textContent).toBe("main-1");
    expect(mock.get).not.toHaveBeenCalled();
  });

  it("reconciles dirty retained Owner Bookings only when visible", async () => {
    const store = createWorkspaceGenerationStore();
    renderView({ store });
    act(() => store.invalidate("owner-bookings"));
    expect(mock.get).not.toHaveBeenCalled();
    act(() => store.setActive("owner-bookings"));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("updated"));
  });

  it("does not launch a second legacy refresh for a retained mutation signal", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-bookings");
    renderView({ store });
    fireEvent.click(screen.getByRole("button", { name: "Mutation completed" }));
    expect(mock.get).not.toHaveBeenCalled();
    // The authenticated provider owns the single generation invalidation.
    act(() => store.invalidate("owner-bookings"));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("updated"));
  });

  it("rejects a late response from an invalidated retained generation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-bookings");
    const first = pending<{ bookings: WorkspaceBookingRow[] }>();
    const second = pending<{ bookings: WorkspaceBookingRow[] }>();
    mock.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderView({ store });

    act(() => store.invalidate("owner-bookings"));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    act(() => store.invalidate("owner-bookings"));
    await act(async () => first.resolve({ bookings: [row("STALE")] }));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("rows").textContent).toBe("main-1");

    await act(async () => second.resolve({ bookings: [row("fresh")] }));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("fresh"));
  });

  it("keeps validated same-query bookings when a retained request fails", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("owner-bookings");
    const d = pending<{ bookings: WorkspaceBookingRow[] }>();
    mock.get.mockReturnValue(d.promise);
    renderView({ store });
    act(() => store.invalidate("owner-bookings"));
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(1));
    await act(async () => d.reject(new Error("network")));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("last validated list"));
    expect(screen.getByTestId("rows").textContent).toBe("main-1");
  });
});
