/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";
import { workspace, DATE } from "../../lib/cash-flow/fixtures";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), save: vi.fn() }));
vi.mock("@/app/(dashboard)/crm/cash-flow/actions", () => ({ refreshCashFlow: mocks.refresh }));
vi.mock("@/app/(dashboard)/crm/reconciliation/actions", () => ({
  upsertReconciliationAction: mocks.save,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue(workspace());
  mocks.save.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
const selectTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const panel = () => within(screen.getByRole("tabpanel"));

describe("Cash Flow internal workspace", () => {
  it("defaults to Today with four local tabs and truthful CF1 metrics", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Today",
      "Ledger",
      "Day Close",
      "History",
    ]);

    expect(screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")).toBe("true");

    expect(panel().getByText("Recorded Payments")).toBeTruthy();
    expect(panel().getByText("₱1,300.00")).toBeTruthy();
    expect(panel().getAllByText("₱700.00").length).toBeGreaterThan(0);

    expect(panel().queryByText("Expenses")).toBeNull();
    expect(panel().queryByText("Net Flow")).toBeNull();
    expect(screen.queryByRole("button", { name: "+ New Entry" })).toBeNull();

    const url = window.location.href;

    for (const tab of ["Ledger", "Day Close", "History", "Today"]) {
      selectTab(tab);
    }

    expect(window.location.href).toBe(url);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renders refunded booking snapshots neutrally in Today and Ledger", () => {
    const data = workspace();

    for (const entry of data.today.entries) {
      if (entry.amount > 0) entry.paymentStatus = "refunded";
    }

    for (const day of data.days) {
      for (const entry of day.entries) {
        if (entry.amount > 0) entry.paymentStatus = "refunded";
      }
    }

    render(<CashFlowWorkspace initialData={data} />);

    const todayRefund = panel().getAllByText("Refunded snapshot")[0]?.closest("button");

    expect(todayRefund).toBeTruthy();
    expect(todayRefund?.textContent).not.toContain("+₱");

    selectTab("Ledger");

    const ledgerRefund = panel().getAllByText("Refunded snapshot")[0]?.closest("button");

    expect(ledgerRefund).toBeTruthy();
    expect(ledgerRefund?.textContent).not.toContain("+₱");
  });
  it("retains ledger filters and the real Day Close draft across tab switches", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    selectTab("Ledger");
    fireEvent.change(panel().getByLabelText("Source"), { target: { value: "home_service" } });
    expect(panel().getByRole("status").textContent).toBe("1 booking records");
    selectTab("Day Close");
    fireEvent.change(panel().getByLabelText("Actual Cash amount"), { target: { value: "123" } });
    selectTab("History");
    selectTab("Day Close");
    expect((panel().getByLabelText("Actual Cash amount") as HTMLInputElement).value).toBe("123");
    selectTab("Ledger");
    expect((panel().getByLabelText("Source") as HTMLSelectElement).value).toBe("home_service");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("opens canonical details and drills into a historical day without navigation", async () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    selectTab("Ledger");
    fireEvent.click(
      panel().getByRole("button", { name: `View Test Home Guest, Test Service, ${DATE}` })
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("link", { name: "Open Booking" }).getAttribute("href")).toContain(
      "bookingId=booking-b"
    );
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    selectTab("History");
    fireEvent.click(panel().getByRole("button", { name: "View day 2026-09-25" }));
    expect(panel().getByText("approved")).toBeTruthy();
    expect(panel().getByRole("status").textContent).toBe("1 booking records");
    expect(panel().queryByRole("button", { name: "Save Draft" })).toBeNull();
  });
  it("reuses the existing reconciliation action and refreshes after a successful save", async () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    selectTab("Day Close");
    fireEvent.change(panel().getByLabelText("Actual Cash amount"), { target: { value: "123" } });
    fireEvent.click(panel().getByRole("button", { name: /Save Draft/i }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: "branch-a",
          date: DATE,
          actualCash: "123",
          status: "draft",
        })
      )
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
  it("keeps approved counts locked and displays their saved expected values", () => {
    const data = workspace();
    data.today.reconciliation!.status = "approved";
    render(<CashFlowWorkspace initialData={data} />);
    selectTab("Day Close");
    expect((panel().getByLabelText("Actual Cash amount") as HTMLInputElement).disabled).toBe(true);
    expect(panel().queryByRole("button", { name: /Save Draft/i })).toBeNull();
    expect(panel().getByText("Approved and locked")).toBeTruthy();
  });
  it("refreshes on a booking event, keeps records on failure and cleans up listeners", async () => {
    mocks.refresh.mockRejectedValue(new Error("offline"));

    const view = render(<CashFlowWorkspace initialData={workspace()} />);

    act(() => {
      window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));
    });

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Refresh unavailable")).toBeTruthy());

    expect(panel().getByText("₱1,300.00")).toBeTruthy();

    view.unmount();

    window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh merely because the browser window regains focus", async () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    window.dispatchEvent(new Event("focus"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("loads dates only on explicit submit and validates the 31-day bound", async () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    selectTab("History");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Load dates" }));
    expect(screen.getByText("Choose a valid date range of up to 31 days.")).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Load dates" }));
    await waitFor(() =>
      expect(mocks.refresh).toHaveBeenCalledWith({ from: "2026-09-01", to: DATE })
    );
  });

  it("does not let an older event refresh replace a newer manual refresh", async () => {
    let resolveFirst!: (value: ReturnType<typeof workspace>) => void;
    let resolveSecond!: (value: ReturnType<typeof workspace>) => void;

    mocks.refresh
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    render(<CashFlowWorkspace initialData={workspace()} />);

    act(() => {
      window.dispatchEvent(new Event(BOOKINGS_CHANGED_EVENT));
    });

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(2));

    const newer = workspace();
    newer.today.summary.total_collected = 1800;

    await act(async () => {
      resolveSecond(newer);
    });

    await act(async () => {
      resolveFirst(workspace());
    });

    expect(panel().getByText("₱1,800.00")).toBeTruthy();
  });
  it("surfaces canonical save errors and keeps entered actual counts", async () => {
    mocks.save.mockResolvedValue({ ok: false, error: "TEST rejected save" });
    render(<CashFlowWorkspace initialData={workspace()} />);
    selectTab("Day Close");
    fireEvent.change(panel().getByLabelText("Actual Cash amount"), { target: { value: "123" } });
    fireEvent.click(panel().getByRole("button", { name: /Save Draft/i }));
    await waitFor(() => expect(panel().getByText("TEST rejected save")).toBeTruthy());
    expect((panel().getByLabelText("Actual Cash amount") as HTMLInputElement).value).toBe("123");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
