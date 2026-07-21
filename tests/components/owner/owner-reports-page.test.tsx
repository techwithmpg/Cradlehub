/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerReportsPage } from "@/components/features/owner/reports/owner-reports-page";
import type { OwnerReportsData } from "@/app/(dashboard)/owner/bookings/actions";

let currentSearchParams = new URLSearchParams("preset=last7");
const getReports = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));
vi.mock("@/app/(dashboard)/owner/bookings/actions", () => ({
  getOwnerReportsDataAction: (request: unknown) => getReports(request),
}));
vi.mock("@/components/features/dashboard/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/features/dashboard/daily-cash-summary", () => ({ DailyCashSummary: () => null }));
vi.mock("@/components/features/owner/reports/revenue-by-branch-card", () => ({ RevenueByBranchCard: () => null }));
vi.mock("@/components/features/owner/reports/staff-productivity-card", () => ({ StaffProductivityCard: () => null }));
vi.mock("@/components/features/owner/reports/booking-trend-card", () => ({ BookingTrendCard: () => null }));
vi.mock("@/components/features/owner/reports/reports-empty-state", () => ({ ReportsEmptyState: () => null }));
vi.mock("@/components/features/owner/reports/report-kpi-cards", () => ({
  ReportKpiCards: ({ revenueData }: { revenueData: Array<{ name?: string }> }) => (
    <div data-testid="report-data">{revenueData[0]?.name}</div>
  ),
}));

function reportData(marker: string, preset: string): OwnerReportsData {
  return {
    preset,
    from: preset === "last30" ? "2026-06-21" : "2026-07-14",
    to: "2026-07-21",
    dateRangeLabel: marker,
    generatedAt: "2026-07-21T12:00:00.000Z",
    revenueData: [{ name: marker, revenue: 1, count: 1 }],
    staffData: [],
    trendData: [],
    cashSummary: {} as OwnerReportsData["cashSummary"],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => {
  currentSearchParams = new URLSearchParams("preset=last7");
  getReports.mockReset();
  window.history.replaceState(null, "", "/owner/reports?preset=last7");
});
afterEach(cleanup);

describe("OwnerReportsPage retained data", () => {
  it("keeps previous charts visible while a history-backed filter revalidates", async () => {
    const nextRequest = deferred<{ success: true; data: OwnerReportsData }>();
    getReports.mockReturnValue(nextRequest.promise);
    const initialData = reportData("last-seven-data", "last7");
    const view = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={initialData} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    fireEvent.click(screen.getByRole("button", { name: "Last 30 Days" }));
    expect(window.location.search).toBe("?preset=last30");

    currentSearchParams = new URLSearchParams("preset=last30");
    view.rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <OwnerReportsPage initialData={initialData} initialRequest={{ preset: "last7" }} />
      </SWRConfig>
    );

    expect(screen.getByTestId("report-data").textContent).toBe("last-seven-data");
    expect(screen.getByText("Updating report data…")).toBeTruthy();

    nextRequest.resolve({ success: true, data: reportData("last-thirty-data", "last30") });
    await waitFor(() =>
      expect(screen.getByTestId("report-data").textContent).toBe("last-thirty-data")
    );
  });
});
