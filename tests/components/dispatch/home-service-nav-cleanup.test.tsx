/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import type { DispatchData } from "@/lib/queries/dispatch-queries";

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
  refreshDispatchDataAction: vi.fn().mockResolvedValue({ success: true }),
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

  it("switches to Full Map view smoothly when clicking Full Map tab", () => {
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
    expect(screen.getByTestId("dispatch-map-content")).toBeDefined();
    expect(screen.queryByTestId("dispatch-flow-content")).toBeNull();
  });
});
