/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashFlowHistory, exportDailyHistoryToCsv } from "@/components/features/cash-flow/cash-flow-history";
import { workspace, DATE } from "../../lib/cash-flow/fixtures";

afterEach(cleanup);

describe("Cash Flow History tab", () => {
  it("renders four top KPI cards with truthful range metrics without invented comparisons", () => {
    const data = workspace();
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    // 1. Total Inflow (Range)
    expect(screen.getByText("Total Inflow (Range)")).toBeTruthy();
    // 2. Total Outflow (Range)
    expect(screen.getByText("Total Outflow (Range)")).toBeTruthy();
    // 3. Net Flow (Range)
    expect(screen.getByText("Net Flow (Range)")).toBeTruthy();
    // 4. Days in Period
    expect(screen.getByText("Days in Period")).toBeTruthy();

    // Verify no fabricated comparison text exists
    expect(screen.queryByText(/vs\. previous period/i)).toBeNull();
    expect(screen.queryByText(/vs\. yesterday/i)).toBeNull();
  });

  it("calculates total inflow, outflow, and net flow accurately across days", () => {
    const data = workspace();
    // today collected = 1300, 2026-09-25 collected = 500 => Total 1800
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    // Inflow: ₱1,800.00
    expect(screen.getAllByText("₱1,800.00").length).toBeGreaterThan(0);
    // Outflow: ₱0.00
    expect(screen.getAllByText("₱0.00").length).toBeGreaterThan(0);
    // Net flow: ₱1,800.00
    expect(screen.getAllByText("₱1,800.00").length).toBeGreaterThan(0);
  });

  it("calculates payment method distribution percentages truthfully", () => {
    const data = workspace();
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    expect(screen.getByText("Payment method distribution")).toBeTruthy();
    expect(screen.getByText("Total Inflow")).toBeTruthy();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
  });

  it("supports daily grouping and category/status filtering", () => {
    const data = workspace();
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    // Status filter
    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "reviewed" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    // Only reviewed records (2026-09-25) should be visible
    expect(screen.getByText(/2026-09-25/)).toBeTruthy();
    expect(screen.queryByText(/2026-09-26/)).toBeNull();

    // Clear restores default view
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText(/2026-09-26/)).toBeTruthy();
  });

  it("triggers drill-down when a row or eye action is clicked", () => {
    const onSelect = vi.fn();
    const data = workspace();
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={onSelect}
        onRangeChange={vi.fn()}
      />
    );

    // Eye button action
    const viewButton = screen.getByRole("button", { name: "View day 2026-09-25" });
    fireEvent.click(viewButton);
    expect(onSelect).toHaveBeenCalledWith("2026-09-25");
  });

  it("renders a zero-data state cleanly when no days are present", () => {
    render(
      <CashFlowHistory
        days={[]}
        range={{ from: DATE, to: DATE }}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    expect(screen.getByText("No financial activity recorded in this period.")).toBeTruthy();
    expect(screen.getByText("No daily records found matching your filters.")).toBeTruthy();
  });

  it("paginates records properly without throwing", () => {
    const data = workspace();
    render(
      <CashFlowHistory
        days={data.days}
        range={data.range}
        onSelect={vi.fn()}
        onRangeChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing 1–2 of 2 records/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("exports daily history records to CSV without errors", () => {
    const data = workspace();
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    expect(() => exportDailyHistoryToCsv(data.days)).not.toThrow();
    expect(createObjectURL).toHaveBeenCalled();
  });
});
