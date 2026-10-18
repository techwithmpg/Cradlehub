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
  AllCustomersTable: ({
    rows,
    onSelect,
  }: {
    rows: Array<{ id: string; full_name: string }>;
    onSelect: (customer: { id: string; full_name: string }) => void;
  }) => (
    <div>
      {rows.map((row) => (
        <button key={row.id} onClick={() => onSelect(row)}>
          select:{row.full_name}
        </button>
      ))}
    </div>
  ),
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
  CustomerPreviewRail: ({
    customer,
  }: {
    customer: { id: string; full_name: string } | null;
  }) => (customer ? <aside data-testid="preview-rail">open:{customer.full_name}</aside> : null),
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

  it("tracks back/forward-style searchParam changes as the current request state", () => {
    currentSearch = "tab=repeat";
    const view = render(<CustomersWorkspace initialData={data({ tab: "repeat" })} />);

    expect(liveHook).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: { tab: "repeat", page: 1, search: undefined },
      })
    );

    currentSearch = "tab=lapsed";
    view.rerender(<CustomersWorkspace initialData={data({ tab: "repeat" })} />);

    expect(liveHook).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: { tab: "lapsed", page: 1, search: undefined },
      })
    );
  });

  it("clearing search removes query and preserves active tab", () => {
    currentSearch = "tab=repeat&q=Ana+Cruz";
    render(
      <CustomersWorkspace
        initialData={data({ tab: "repeat", search: "Ana Cruz" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/crm/customers?tab=repeat"
    );
  });

  it("closes customer preview safely when selected customer is no longer visible", () => {
    const customer1 = {
      id: "cust-1",
      full_name: "Customer One",
      phone: "09171111111",
      email: null,
      total_bookings: 2,
      last_booking_date: "2026-10-18",
    };
    const customer2 = {
      id: "cust-2",
      full_name: "Customer Two",
      phone: "09172222222",
      email: null,
      total_bookings: 1,
      last_booking_date: "2026-10-18",
    };

    currentSearch = "tab=all";
    const initial = data({ tab: "all", allCustomers: [customer1, customer2] });
    const view = render(<CustomersWorkspace initialData={initial} />);

    // Select Customer One
    fireEvent.click(screen.getByRole("button", { name: "select:Customer One" }));
    expect(screen.getByTestId("preview-rail").textContent).toContain("open:Customer One");

    // Reconcile/filter so customer1 is no longer in allCustomers
    const updated = data({ tab: "all", allCustomers: [customer2] });
    liveHook.mockReturnValue({
      data: updated,
      error: undefined,
      isLoading: false,
      isValidating: false,
      revalidate: vi.fn(),
      generation: { store: { invalidate: vi.fn() } },
    });
    view.rerender(<CustomersWorkspace initialData={initial} />);

    // Preview should now be closed safely
    expect(screen.queryByTestId("preview-rail")).toBeNull();
  });
});
