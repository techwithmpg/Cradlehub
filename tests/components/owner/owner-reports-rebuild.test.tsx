/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerReportsPage } from "@/components/features/owner/reports/owner-reports-page";
import type { OwnerReportsData, OwnerReportsRequest } from "@/lib/owner/reports-types";

// Mock server action
const mockGetReports = vi.fn();
vi.mock("@/app/(dashboard)/owner/bookings/actions", () => ({
  getOwnerReportsDataAction: (request: OwnerReportsRequest) => mockGetReports(request),
}));

// Mock next/navigation
let currentSearchParams = new URLSearchParams("preset=last7");
vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

function createMockReportsData(overrides: Partial<OwnerReportsData> = {}): OwnerReportsData {
  return {
    preset: "last7",
    from: "2026-07-14",
    to: "2026-07-21",
    branchId: "all",
    branchName: "All Branches",
    dateRangeLabel: "Jul 14 – Jul 21, 2026",
    generatedAt: "2026-07-21T12:00:00.000Z",
    branches: [
      { id: "branch-1", name: "Main Spa" },
      { id: "branch-2", name: "SM Branch" },
    ],
    kpis: {
      canonicalRevenue: 150000,
      completedServices: 120,
      totalBookings: 135,
      averageBookingValue: 1250,
      collectedPayments: 145000,
      averageTransaction: 1208,
      uniqueCustomers: 85,
      activeStaffCount: 8,
      averageServicesPerStaff: 15,
      avgServicesPerStaff: 15,
    },
    revenueData: [
      {
        branchId: "branch-1",
        name: "Main Spa",
        revenue: 90000,
        count: 80,
        completedCount: 72,
        avgBookingValue: 1250,
        share: 60,
      },
      {
        branchId: "branch-2",
        name: "SM Branch",
        revenue: 60000,
        count: 55,
        completedCount: 48,
        avgBookingValue: 1250,
        share: 40,
      },
    ],
    trendData: [
      {
        date: "2026-07-14",
        count: 20,
        completedCount: 18,
        revenue: 22000,
        collected: 21000,
        branchSeries: {
          "branch-1": 13000,
          "branch-2": 9000,
        },
      },
      {
        date: "2026-07-15",
        count: 25,
        completedCount: 22,
        revenue: 28000,
        collected: 27000,
        branchSeries: {
          "branch-1": 17000,
          "branch-2": 11000,
        },
      },
    ],
    paymentBreakdown: {
      methods: [
        { method: "cash", label: "Cash", amount: 60000, count: 50, percentage: 41 },
        { method: "gcash", label: "GCash", amount: 50000, count: 42, percentage: 34 },
        { method: "card", label: "Card / Terminal", amount: 35000, count: 28, percentage: 25 },
      ],
      totalCollected: 145000,
      totalTransactions: 120,
    },
    serviceData: [
      {
        serviceId: "svc-1",
        name: "Swedish Massage (60m)",
        category: "Massage Therapy",
        completedCount: 45,
        revenue: 40500,
        avgValue: 900,
        share: 38,
        branchBreakdown: { "branch-1": 25, "branch-2": 20 },
      },
      {
        serviceId: "svc-2",
        name: "Deep Tissue Therapy",
        category: "Body Therapy",
        completedCount: 30,
        revenue: 36000,
        avgValue: 1200,
        share: 25,
        branchBreakdown: { "branch-1": 20, "branch-2": 10 },
      },
    ],
    categoryMix: [
      { category: "Massage Therapy", count: 45, revenue: 40500, share: 60 },
      { category: "Body Therapy", count: 30, revenue: 36000, share: 40 },
    ],
    staffData: [
      {
        staffId: "staff-1",
        name: "Elena Ramos",
        tier: "Senior Therapist",
        branchId: "branch-1",
        branchName: "Main Spa",
        total: 35,
        completed: 32,
        completionRate: 91,
        revenue: 38400,
        avgPerService: 1200,
        topService: "Deep Tissue Therapy",
      },
      {
        staffId: "staff-2",
        name: "Maria Santos",
        tier: "Therapist",
        branchId: "branch-2",
        branchName: "SM Branch",
        total: 28,
        completed: 25,
        completionRate: 89,
        revenue: 25000,
        avgPerService: 1000,
        topService: "Swedish Massage (60m)",
      },
    ],
    dailyFinancials: [
      {
        date: "2026-07-14",
        recordedRevenue: 22000,
        collectedPayments: 21000,
        transactions: 18,
        completedBookings: 18,
      },
      {
        date: "2026-07-15",
        recordedRevenue: 28000,
        collectedPayments: 27000,
        transactions: 22,
        completedBookings: 22,
      },
    ],
    topPaymentDays: [
      { date: "2026-07-15", revenue: 28000, collected: 27000, transactions: 22 },
      { date: "2026-07-14", revenue: 22000, collected: 21000, transactions: 18 },
    ],
    sheetEvidence: {
      status: "available",
      observedAt: "2026-07-21T12:00:00.000Z",
      totalRecords: 142,
      visitCount: 118,
      dutyCount: 24,
      needsReviewCount: 3,
      evidenceAmount: 48500,
      effectOnCanonicalTotals: 0,
      recentVisits: [
        {
          id: "sheet-row-1",
          date: "2026-07-20",
          time: "14:30",
          customer: "Anna Cruz",
          attendant: "Elena",
          services: "Swedish Massage",
          channel: "Walk-in",
          amount: 900,
          reasons: [],
          source: "Master Sheet Current Week",
        },
        {
          id: "sheet-row-2",
          date: "2026-07-20",
          time: "16:00",
          customer: "John Doe",
          attendant: "Unassigned",
          services: "Signature Combo",
          channel: "Phone",
          amount: 1500,
          reasons: ["Attendant unassigned"],
          source: "Master Sheet Current Week",
        },
      ],
    },
    ...overrides,
  };
}

describe("Owner Reports Rebuild — Single Workspace & Provenance", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams("preset=last7");
    mockGetReports.mockReset();
    window.history.replaceState(null, "", "/owner/reports?preset=last7");
  });

  afterEach(cleanup);

  it("renders the shared header with canonical and external data sources indicators", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Header title and subtitle
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeTruthy();
    expect(screen.getByText("Business performance and operational insights")).toBeTruthy();

    // Data sources provenance badges
    expect(screen.getByText("CradleHub")).toBeTruthy();
    expect(screen.getByText("Canonical")).toBeTruthy();
    expect(screen.getAllByText("Master Sheet").length).toBeGreaterThan(0);
    expect(screen.getByText("External Read-Only")).toBeTruthy();
  });

  it("renders all six accessible tabs in the single workspace tablist", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    const tablist = screen.getByRole("tablist", { name: /reports workspace tabs/i });
    expect(tablist).toBeTruthy();

    expect(screen.getByRole("tab", { name: /Overview/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Branch Reports/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Financial Reports/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Service Reports/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Staff Reports/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Sheet Evidence/i })).toBeTruthy();
  });

  it("switches tabs immediately via client-side state without full-page navigation", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Initial Overview tab
    expect(screen.getByRole("tab", { name: /Overview/i }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByText("Canonical Revenue")).toBeTruthy();

    // Switch to Financial Reports
    fireEvent.click(screen.getByRole("tab", { name: /Financial Reports/i }));
    expect(
      screen.getByRole("tab", { name: /Financial Reports/i }).getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.getByText("Daily Financial Ledger")).toBeTruthy();
    expect(window.location.search).toContain("view=financial");

    // Switch to Service Reports
    fireEvent.click(screen.getByRole("tab", { name: /Service Reports/i }));
    expect(screen.getByText("Service Catalog Performance")).toBeTruthy();
    expect(screen.getAllByText("Swedish Massage (60m)").length).toBeGreaterThan(0);
    expect(window.location.search).toContain("view=service");

    // Switch to Staff Reports
    fireEvent.click(screen.getByRole("tab", { name: /Staff Reports/i }));
    expect(screen.getByText("Staff Productivity Details")).toBeTruthy();
    expect(screen.getAllByText("Elena Ramos").length).toBeGreaterThan(0);
    expect(window.location.search).toContain("view=staff");

    // Switch to Sheet Evidence
    fireEvent.click(screen.getByRole("tab", { name: /Sheet Evidence/i }));
    expect(screen.getByText(/Master Sheet Operational Evidence/i)).toBeTruthy();
    expect(screen.getByText("Effect on Canonical Totals")).toBeTruthy();
    expect(window.location.search).toContain("view=sheet");
  });

  it("handles popstate to sync tab with browser history", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Simulate browser history navigation to view=financial
    window.history.pushState(null, "", "/owner/reports?preset=last7&view=financial");
    fireEvent(window, new PopStateEvent("popstate"));

    expect(
      screen.getByRole("tab", { name: /Financial Reports/i }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("maintains strict mathematical and visual separation for Master Sheet evidence", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Switch to Sheet Evidence
    fireEvent.click(screen.getByRole("tab", { name: /Sheet Evidence/i }));

    // Check strict 0 effect on canonical totals
    const zeroEffectTexts = screen.getAllByText("₱0.00");
    expect(zeroEffectTexts.length).toBeGreaterThan(0);

    // Check BRANCH_UNKNOWN label on sheet records
    const unknownBranches = screen.getAllByText("BRANCH_UNKNOWN");
    expect(unknownBranches.length).toBeGreaterThan(0);

    // Check noncanonical and read-only labels
    expect(screen.getByText("Noncanonical")).toBeTruthy();
  });

  it("switches reporting scope and updates branch subtitle dynamically", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Initial subtitle
    expect(
      screen.getByText("View combined performance across Main Spa and SM Branch")
    ).toBeTruthy();

    // Select Main Spa
    const select = screen.getByRole("combobox", { name: /filter report by branch/i });
    fireEvent.change(select, { target: { value: "branch-1" } });

    expect(window.location.search).toContain("branchId=branch-1");
  });

  it("switches date preset using accessible buttons", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Click 30 Days preset
    const btn30 = screen.getByRole("button", { name: "Last 30 Days" });
    fireEvent.click(btn30);

    expect(window.location.search).toContain("preset=last30");
  });

  it("keeps export button explicitly disabled with explanation in Staff Reports", () => {
    const data = createMockReportsData();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={data} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    // Navigate to Staff tab
    fireEvent.click(screen.getByRole("tab", { name: /Staff Reports/i }));

    const exportBtn = screen.getByRole("button", { name: /Export/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    expect(exportBtn.getAttribute("title")).toContain("disabled pending authorized");
  });
});
