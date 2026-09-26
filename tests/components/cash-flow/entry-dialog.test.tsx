/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";
import { CashFlowEntryDialog } from "@/components/features/cash-flow/cash-flow-entry-dialog";
import { workspace } from "../../lib/cash-flow/fixtures";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  save: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/app/(dashboard)/crm/cash-flow/actions", () => ({
  refreshCashFlow: mocks.refresh,
}));
vi.mock("@/app/(dashboard)/crm/reconciliation/actions", () => ({
  upsertReconciliationAction: mocks.save,
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: mocks.toastInfo,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue(workspace());
  mocks.save.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe("Central Cash Flow Modal — Create Mode", () => {
  it("1. + New Entry opens modal", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    const newEntryBtn = screen.getByRole("button", { name: /New Entry/i });
    expect(newEntryBtn).toBeTruthy();

    fireEvent.click(newEntryBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("New Cash Flow Entry")).toBeTruthy();
    expect(within(dialog).getByText("Create")).toBeTruthy();
  });

  it("2. Expense can be selected with distinct style", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    const expenseRadio = within(dialog).getByRole("radio", { name: /Expense/i });
    fireEvent.click(expenseRadio);

    expect(expenseRadio.getAttribute("aria-checked")).toBe("true");
    expect(within(expenseRadio).getByTestId("selected-check")).toBeTruthy();
  });

  it("3. entry types switch form state", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");

    // Starts with Expense fields
    expect(within(dialog).getByText(/Paid To \/ Source/i)).toBeTruthy();

    // Switch to Tip
    fireEvent.click(within(dialog).getByRole("radio", { name: /Tip/i }));
    expect(within(dialog).queryByText(/Paid To \/ Source/i)).toBeNull();

    // Switch to Refund
    fireEvent.click(within(dialog).getByRole("radio", { name: /Refund/i }));
    expect(within(dialog).getByText(/Customer \/ Reference/i)).toBeTruthy();
  });

  it("4. Transfer displays From + To and validates accounts differ", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Transfer/i }));

    expect(within(dialog).getByText(/From Account/i)).toBeTruthy();
    expect(within(dialog).getByText(/To Account/i)).toBeTruthy();

    // Enter amount
    const amountInput = within(dialog).getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "500" } });

    // Set same from and to
    const selects = dialog.querySelectorAll("select");
    const fromSelect = selects[0]!;
    const toSelect = selects[1]!;
    fireEvent.change(fromSelect, { target: { value: "cash" } });
    fireEvent.change(toSelect, { target: { value: "cash" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /Record entry/i }));

    expect(within(dialog).getByText(/Source and destination accounts must be different/i)).toBeTruthy();
  });

  it("5. Staff Advance shows staff selector", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Staff Advance/i }));

    expect(within(dialog).getByLabelText(/Staff Member/i)).toBeTruthy();
    expect(within(dialog).getByText("Select staff member")).toBeTruthy();
  });

  it("6. Expense shows category and source inputs", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Expense/i }));

    expect(within(dialog).getByText(/Select category/i)).toBeTruthy();
    expect(within(dialog).getByPlaceholderText(/Supplier name, staff name/i)).toBeTruthy();
  });

  it("7. required validation works for empty submission", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Record entry/i }));

    expect(within(dialog).getByText(/Please enter a valid amount greater than 0/i)).toBeTruthy();
    expect(within(dialog).getByText(/Please select a payment method/i)).toBeTruthy();
  });

  it("8. Cancel closes create modal", async () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("9. prototype Record Entry does NOT mutate data", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));

    const dialog = screen.getByRole("dialog");

    // Fill valid form
    fireEvent.change(within(dialog).getByPlaceholderText("0.00"), { target: { value: "1500" } });
    const selects = dialog.querySelectorAll("select");
    // selects[0] is Category
    fireEvent.change(selects[0]!, { target: { value: "Supplies" } });
    // selects[1] is Payment Method
    fireEvent.change(selects[1]!, { target: { value: "cash" } });
    fireEvent.change(within(dialog).getByPlaceholderText(/Supplier name, staff name/i), {
      target: { value: "Spa Warehouse" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: /Record entry/i }));

    // Non-destructive prototype notification
    expect(within(dialog).getByTestId("prototype-notice")).toBeTruthy();
    expect(
      within(dialog).getByText("Cash Flow entry wiring is not enabled in this UI pass.")
    ).toBeTruthy();

    // Verified zero mutations
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("Central Cash Flow Modal — Correction Mode", () => {
  const sampleEntry = workspace().days[0]!.entries[0]!;

  it("10. Correction mode opens with correction pill", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Correct Cash Flow Entry")).toBeTruthy();
    expect(within(dialog).getByText("Correction mode")).toBeTruthy();
  });

  it("11. original transaction is displayed in summary card", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Original transaction")).toBeTruthy();
    expect(within(dialog).getByText(sampleEntry.service || sampleEntry.customer)).toBeTruthy();
  });

  it("12. correction action selection works", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    const correctCategoryRadio = within(dialog).getByRole("radio", { name: /Correct category/i });
    fireEvent.click(correctCategoryRadio);

    expect(correctCategoryRadio.getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).getByText("Current Category")).toBeTruthy();
    expect(within(dialog).getByText(/Corrected Category/i)).toBeTruthy();
  });

  it("13. amount difference calculates correctly in UI", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={{ ...sampleEntry, amount: 1000 }}
      />
    );

    const dialog = screen.getByRole("dialog");
    const amountInput = dialog.querySelector("input[value='1,450.00']");
    expect(amountInput).toBeTruthy();

    // Difference between 1,450 and 1,000 is +450.00
    const diff = within(dialog).getByTestId("difference-display");
    expect(diff.textContent).toContain("450.00");
  });

  it("14. Reverse shows correct confirmation fields", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Reverse transaction/i }));

    expect(within(dialog).getByText("Reversal Confirmation")).toBeTruthy();
    expect(within(dialog).getByText(/completely reverse this transaction/i)).toBeTruthy();
  });

  it("15. category correction shows category controls", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Correct category/i }));

    expect(within(dialog).getByText("Current Category")).toBeTruthy();
    expect(within(dialog).getByText(/Corrected Category/i)).toBeTruthy();
  });

  it("16. method correction shows method controls", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /Correct payment method/i }));

    expect(within(dialog).getByText("Current Payment Method")).toBeTruthy();
    expect(within(dialog).getByText(/Corrected Payment Method/i)).toBeTruthy();
  });

  it("17. audit preview updates locally with pending status", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Audit trail preview")).toBeTruthy();
    expect(within(dialog).getByText("Original entry")).toBeTruthy();
    expect(within(dialog).getByText("Correction entry")).toBeTruthy();
    expect(within(dialog).getByText("Pending correction")).toBeTruthy();
  });

  it("18. Record Correction does NOT mutate data", () => {
    render(
      <CashFlowEntryDialog
        open={true}
        onOpenChange={() => {}}
        mode="correct"
        transaction={sampleEntry}
      />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Record correction/i }));

    expect(within(dialog).getByTestId("prototype-notice")).toBeTruthy();
    expect(
      within(dialog).getByText("Correction persistence is not wired in this UI pass.")
    ).toBeTruthy();

    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("Centralization and Cross-Tab Consistency", () => {
  it("19 & 20. Today and Ledger open SAME shared dialog instance (no duplicate modals)", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    // From Today: click + New Entry
    fireEvent.click(screen.getByRole("button", { name: /New Entry/i }));
    expect(screen.getAllByRole("dialog").length).toBe(1);

    // Close
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Switch to Ledger
    fireEvent.click(screen.getByRole("tab", { name: "Ledger" }));

    // In Ledger: click + New Entry
    const ledgerNewEntry = screen.getByRole("button", { name: /New Entry/i });
    fireEvent.click(ledgerNewEntry);

    // Exactly one singleton dialog
    expect(screen.getAllByRole("dialog").length).toBe(1);
    expect(screen.getByText("New Cash Flow Entry")).toBeTruthy();
  });

  it("21. tab switching preserves workspace state without unnecessary reloads", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    for (const tab of ["Ledger", "Day Close", "History", "Today"]) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
    }

    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("22. coverage category clicks pre-select manual entry types in Create modal", () => {
    render(<CashFlowWorkspace initialData={workspace()} />);

    // Click on "Expenses" coverage tile in Today view
    const buttons = screen.getAllByRole("button");
    const expensesTile = buttons.find(
      (btn) => btn.textContent?.includes("Expenses") && btn.textContent?.includes("record")
    );
    expect(expensesTile).toBeTruthy();
    fireEvent.click(expensesTile!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    const expenseRadio = within(dialog).getByRole("radio", { name: /Expense/i });
    expect(expenseRadio.getAttribute("aria-checked")).toBe("true");
  });
});
