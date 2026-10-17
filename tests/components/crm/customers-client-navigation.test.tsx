/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmCustomersWorkspaceData } from "@/components/features/crm/customers/customer-workspace-data";

let currentSearch = "tab=all";
const liveHook = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/components/features/crm/customers/use-live-crm-customers-data", () => ({
  useLiveCrmCustomersData: (...args: unknown[]) => liveHook(...args),
}));

vi.mock("@/components/features/dashboard/page-header", () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <header><h1>{title}</h1>{action}</header>
  ),
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  OpenAdministrativeBookingButton: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

vi.mock("@/components/features/crm/premium/crm-motion-section", () => ({
  CrmMotionSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/features/crm/customers/customer-segment-tabs", () => ({
  CustomerSegmentTabs: ({
    activeTab,
    onSelect,
  }: {
    activeTab: string;
    onSelect: (tab: "all" | "repeat" | "lapsed" | "followup") => void;
  }) => (
    <div>
      <span>active:{activeTab}</span>
      <button onClick={() => onSelect("repeat")}>Repeat Clients</button>
      <button onClick={() => onSelect("all")}>All Customers</button>
    </div>
  ),
}));

vi.mock("@/components/features/crm/customers/customer-kpi-row", () => ({
  CustomerKpiRow: () => <div>KPI</div>,
}));
vi.mock("@/components/features/crm/customers/all-customers-table", () => ({
  AllCustomersTable: () => <div>All table</div>,
}));
vi.mock("@/components/features/crm/customers/repeat-clients-table", () => ({
  RepeatClientsTable: () => <div>Repeat table</div>,
}));
vi.mock("@/components/features/crm/customers/lapsed-clients-table", () => ({
  LapsedClientsTable: () => <div>Lapsed table</div>,
}));
vi.mock("@/components/features/crm/customers/waitlist-followup-table", () => ({
  WaitlistFollowupTable: () => <div>Follow-up table</div>,
}));
vi.mock("@/components/features/crm/customers/customer-preview-rail", () => ({
  CustomerPreviewRail: () => null,
}));

import { CustomersWorkspace } from "@/components/features/crm/customers/customers-workspace";

function data(overrides: Partial<CrmCustomersWorkspaceData> = {}): CrmCustomersWorkspaceData {
  return {
    tab: "all",
    page: 1,
    search: undefined,
    allCustomers: [],
    repeatCustomers: [],
    lapsedCustomers: [],
    waitlistRows: [],
    kpiData: {
      totalCustomers: 0,
      repeatClients: 0,
      lapsedClients: 0,
      newThisMonth: 0,
      totalVisits: 0,
    },
    totalPages: 3,
    ...overrides,
  };
}

beforeEach(() => {
  currentSearch = "tab=all";
  liveHook.mockReset();
  liveHook.mockImplementation(({ request, fallbackData }) => ({
    data: { ...fallbackData, ...request },
    error: undefined,
    revalidate: vi.fn(),
    generation: { store: { invalidate: vi.fn() } },
  }));
  vi.spyOn(window.history, "pushState");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-6 CRM Customers native-history navigation", () => {
  it("switches segments through pushState instead of route navigation", () => {
    render(<CustomersWorkspace initialData={data()} />);

    fireEvent.click(screen.getByRole("button", { name: "Repeat Clients" }));

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/crm/customers?tab=repeat"
    );
  });

  it("search resets pagination and keeps the active segment in the shareable URL", () => {
    currentSearch = "tab=repeat&page=4";
    render(<CustomersWorkspace initialData={data({ tab: "repeat", page: 4 })} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Ana Cruz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/crm/customers?tab=repeat&q=Ana+Cruz"
    );
  });

  it("pagination changes URL state without replacing the workspace", () => {
    currentSearch = "tab=all";
    render(<CustomersWorkspace initialData={data()} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/crm/customers?tab=all&page=2"
    );
  });
});
