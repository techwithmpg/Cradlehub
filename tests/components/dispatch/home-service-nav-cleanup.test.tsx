/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import {
  RetainedWorkspaceModule,
  RetainedWorkspaceProvider,
} from "@/components/features/dashboard/retained-workspace-provider";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";

let currentPathname = "/crm/dispatch";
let currentSearch = new URLSearchParams();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearch,
  useRouter: () => ({ push: routerPush }),
}));

// Mock child components that might make network calls
vi.mock("@/components/features/dispatch/dispatch-flow-tab", () => ({
  DispatchFlowTab: () => (
    <div data-testid="dispatch-flow-content">{"Today's Home Visits Content"}</div>
  ),
}));

vi.mock("@/components/features/dispatch/dispatch-live-map-tab", () => ({
  DispatchLiveMapTab: () => <div data-testid="dispatch-map-content">Interactive Map Content</div>,
}));

vi.mock("@/lib/actions/dispatch-data-actions", () => ({
  refreshDispatchDataAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      today: "2026-10-06",
      items: [],
      alerts: [],
      stats: {
        totalToday: 0,
        awaitingDispatch: 0,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
    },
  }),
}));

function createMockDispatchData(): DispatchData {
  return {
    today: "2026-10-06",
    items: [],
    alerts: [],
    stats: {
      totalToday: 0,
      awaitingDispatch: 0,
      activeTrips: 0,
      completedToday: 0,
      cancelledToday: 0,
    },
  };
}

describe("Home Service Operations Navigation Cleanup", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Home Service Operations without duplicate Dispatch Queue / Live Map top buttons", () => {
    const data = createMockDispatchData();

    render(
      <CrmOperationalPageShell
        title="Home Service Operations"
        description="Monitor home-service bookings, assignments, customer locations, and travel progress."
        context="Main Spa · 2026-10-06 · crm view"
      >
        <HomeServiceDispatchWorkspace role="crm" data={data} showHeader={false} />
      </CrmOperationalPageShell>
    );

    // 1. Verify title and context render correctly
    expect(screen.getByRole("heading", { name: "Home Service Operations" })).toBeDefined();
    expect(screen.getByText(/Main Spa · 2026-10-06 · crm view/)).toBeDefined();

    // 2. Verify duplicate top navigation buttons are NOT present
    expect(screen.queryByRole("link", { name: "Dispatch Queue" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Live Map" })).toBeNull();
    expect(screen.queryByText("Dispatch Queue")).toBeNull();

    // 3. Verify canonical views are present
    const liveOpsTab = screen.getByRole("tab", { name: "Live Operations" });
    const fullMapTab = screen.getByRole("tab", { name: "Full Map" });
    expect(liveOpsTab).toBeDefined();
    expect(fullMapTab).toBeDefined();

    // 4. Default active tab is Live Operations
    expect(liveOpsTab.getAttribute("aria-selected")).toBe("true");
    expect(fullMapTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("dispatch-flow-content")).toBeDefined();
  });

  it("switches to Full Map view smoothly when clicking Full Map tab", async () => {
    const data = createMockDispatchData();

    render(
      <CrmOperationalPageShell
        title="Home Service Operations"
        description="Monitor home-service bookings, assignments, customer locations, and travel progress."
        context="Main Spa · 2026-10-06 · crm view"
      >
        <HomeServiceDispatchWorkspace role="crm" data={data} showHeader={false} />
      </CrmOperationalPageShell>
    );

    const fullMapTab = screen.getByRole("tab", { name: "Full Map" });
    const liveOpsTab = screen.getByRole("tab", { name: "Live Operations" });

    // Click Full Map tab
    fireEvent.click(fullMapTab);

    // Verify tab states update
    expect(fullMapTab.getAttribute("aria-selected")).toBe("true");
    expect(liveOpsTab.getAttribute("aria-selected")).toBe("false");
    await waitFor(() => expect(screen.getByTestId("dispatch-map-content")).toBeDefined());
    expect(screen.queryByTestId("dispatch-flow-content")).toBeNull();
  });

  it("keeps global Full Map available from the Upcoming list", async () => {
    const data = createMockDispatchData();
    render(<HomeServiceDispatchWorkspace role="crm" data={data} upcoming showHeader={false} />);

    fireEvent.click(screen.getByRole("tab", { name: "Full Map" }));
    await waitFor(() => expect(screen.getByTestId("dispatch-map-content")).toBeDefined());
    expect(refreshDispatchDataAction).toHaveBeenCalledWith("2026-10-06", {
      scope: "active_map",
    });
  });
});

describe("CRM Dispatch Tab Navigation and Retention Safety", () => {
  beforeEach(() => {
    currentPathname = "/crm/dispatch";
    currentSearch = new URLSearchParams();
    routerPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  function renderRetainedDispatch(upcoming = false, bookingId?: string) {
    currentPathname = "/crm/dispatch";
    currentSearch = new URLSearchParams(
      bookingId
        ? `tab=${upcoming ? "upcoming" : "today"}&bookingId=${bookingId}`
        : upcoming
        ? "tab=upcoming"
        : "tab=today"
    );
    const descriptor = resolveWorkspaceModule("crm", currentPathname, currentSearch);
    const data = createMockDispatchData();
    return (
      <main data-testid="workspace-main">
        <RetainedWorkspaceProvider
          workspace="crm"
          userId="user-1"
          role="crm"
          branchId="branch-1"
          enabled
        >
          {descriptor ? (
            <RetainedWorkspaceModule moduleId={descriptor.moduleId}>
              <HomeServiceDispatchWorkspace
                role="crm"
                data={data}
                upcoming={upcoming}
                selectedBookingId={bookingId}
                showHeader={false}
              />
            </RetainedWorkspaceModule>
          ) : (
            <HomeServiceDispatchWorkspace
              role="crm"
              data={data}
              upcoming={upcoming}
              selectedBookingId={bookingId}
              showHeader={false}
            />
          )}
        </RetainedWorkspaceProvider>
      </main>
    );
  }

  it("A. Today -> Upcoming -> Today: preserves explicit target /crm/dispatch?tab=today and does not become upcoming", () => {
    // Starting Today: /crm/dispatch?tab=today
    const view = render(renderRetainedDispatch(false));

    const upcomingLink = screen.getByRole("link", { name: "Upcoming" });
    expect(upcomingLink.getAttribute("href")).toBe("/crm/dispatch?tab=upcoming");

    // Click Upcoming -> expected target /crm/dispatch?tab=upcoming
    fireEvent.click(upcomingLink);
    expect(upcomingLink.getAttribute("href")).toBe("/crm/dispatch?tab=upcoming");

    // View moves to Upcoming: /crm/dispatch?tab=upcoming
    view.rerender(renderRetainedDispatch(true));

    const todayLink = screen.getByRole("link", { name: "Today" });
    expect(todayLink.getAttribute("href")).toBe("/crm/dispatch?tab=today");

    // Click Today -> expected target /crm/dispatch?tab=today
    fireEvent.click(todayLink);

    // The Today target must NOT become /crm/dispatch?tab=upcoming
    expect(todayLink.getAttribute("href")).toBe("/crm/dispatch?tab=today");
    expect(routerPush).not.toHaveBeenCalledWith(expect.stringContaining("tab=upcoming"));
  });

  it("B. Deep link -> Today clears booking ID and does not restore tab=upcoming", () => {
    // Start from a retained Dispatch state representing: /crm/dispatch?tab=upcoming&bookingId=future-1
    render(renderRetainedDispatch(true, "future-1"));

    const todayLink = screen.getByRole("link", { name: "Today" });
    expect(todayLink.getAttribute("href")).toBe("/crm/dispatch?tab=today");

    // Click Today
    fireEvent.click(todayLink);

    // The Today target must NOT contain bookingId=future-1 and must NOT restore tab=upcoming
    expect(todayLink.getAttribute("href")).toBe("/crm/dispatch?tab=today");
    expect(todayLink.getAttribute("href")).not.toContain("bookingId=future-1");
    expect(todayLink.getAttribute("href")).not.toContain("tab=upcoming");
    expect(routerPush).not.toHaveBeenCalledWith(expect.stringContaining("bookingId=future-1"));
    expect(routerPush).not.toHaveBeenCalledWith(expect.stringContaining("tab=upcoming"));

    // Verify defect behavior: A queryless link to /crm/dispatch WOULD have restored the query
    const querylessLink = document.createElement("a");
    querylessLink.href = "/crm/dispatch";
    document.body.appendChild(querylessLink);
    fireEvent.click(querylessLink);
    expect(routerPush).toHaveBeenCalledWith("/crm/dispatch?bookingId=future-1&tab=upcoming");
    document.body.removeChild(querylessLink);
  });

  it("C. Active state: renders aria-current='page' on active tab and undefined on inactive tab", () => {
    // On ?tab=today (upcoming=false)
    const { rerender } = render(
      <HomeServiceDispatchWorkspace
        role="crm"
        data={createMockDispatchData()}
        upcoming={false}
        showHeader={false}
      />
    );

    const todayLink = screen.getByRole("link", { name: "Today" });
    const upcomingLink = screen.getByRole("link", { name: "Upcoming" });

    expect(todayLink.getAttribute("href")).toBe("/crm/dispatch?tab=today");
    expect(todayLink.getAttribute("aria-current")).toBe("page");
    expect(upcomingLink.getAttribute("href")).toBe("/crm/dispatch?tab=upcoming");
    expect(upcomingLink.getAttribute("aria-current")).toBeNull();

    // On ?tab=upcoming (upcoming=true)
    rerender(
      <HomeServiceDispatchWorkspace
        role="crm"
        data={createMockDispatchData()}
        upcoming={true}
        showHeader={false}
      />
    );

    const todayLinkUpcoming = screen.getByRole("link", { name: "Today" });
    const upcomingLinkUpcoming = screen.getByRole("link", { name: "Upcoming" });

    expect(todayLinkUpcoming.getAttribute("href")).toBe("/crm/dispatch?tab=today");
    expect(todayLinkUpcoming.getAttribute("aria-current")).toBeNull();
    expect(upcomingLinkUpcoming.getAttribute("href")).toBe("/crm/dispatch?tab=upcoming");
    expect(upcomingLinkUpcoming.getAttribute("aria-current")).toBe("page");
  });
});
