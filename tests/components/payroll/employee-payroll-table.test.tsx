/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeePayrollTable } from "../../../src/components/features/payroll/employee-payroll-table";
import { PayrollPageClient } from "../../../src/components/features/payroll/payroll-page-client";
import { DEFAULT_PAYROLL_SETTINGS } from "../../../src/lib/payroll/fixed-monthly";
import type {
  PayrollDashboardBranch,
  PayrollDashboardData,
  PayrollDashboardStaffRow,
} from "../../../src/lib/queries/payroll";

const refreshMock = vi.fn();
const markPaidMock = vi.fn(async (staffId: string) => {
  return { ok: true as const, data: { staffId, status: "paid" as const } };
});
const markUnpaidMock = vi.fn(async (staffId: string) => {
  return { ok: true as const, data: { staffId, status: "unpaid" as const } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/actions/payroll-dashboard-actions", () => ({
  markStaffPayrollPaidAction: (staffId: string) => markPaidMock(staffId),
  markStaffPayrollUnpaidAction: (staffId: string) => markUnpaidMock(staffId),
  saveMonthlyPayAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updatePayrollSettingsAction: vi.fn(async (settings) => ({ ok: true, data: settings })),
}));

const branches: PayrollDashboardBranch[] = [
  { id: "branch-main", name: "Main Branch" },
  { id: "branch-sm", name: "SM Branch" },
];

function staff(
  overrides: Partial<PayrollDashboardStaffRow> & {
    id: string;
    display_name: string;
  }
): PayrollDashboardStaffRow {
  const branchId = "branch_id" in overrides ? overrides.branch_id ?? null : "branch-main";
  const branchName = "branch_name" in overrides ? overrides.branch_name ?? null : "Main Branch";

  return {
    id: overrides.id,
    display_name: overrides.display_name,
    full_name: overrides.full_name ?? overrides.display_name,
    nickname: overrides.nickname ?? null,
    role_label: overrides.role_label ?? "Therapist",
    branch_id: branchId,
    branch_name: branchName,
    avatar_url: null,
    monthly_pay: overrides.monthly_pay ?? 10000,
    has_monthly_pay: overrides.has_monthly_pay ?? true,
    status: overrides.status ?? "unpaid",
    last_paid_label: overrides.last_paid_label ?? "-",
    current_item_id: overrides.current_item_id ?? null,
  };
}

function renderTable(staffRows: PayrollDashboardStaffRow[], onStatusChanged = vi.fn()) {
  return render(
    <EmployeePayrollTable
      staffRows={staffRows}
      branches={branches}
      allowStatusEditing
      onSetupPay={vi.fn()}
      onStatusChanged={onStatusChanged}
    />
  );
}

function mixedRows() {
  const mainRows = Array.from({ length: 9 }, (_, index) =>
    staff({
      id: `main-${index + 1}`,
      display_name: `Main Staff ${String(index + 1).padStart(2, "0")}`,
      status: index === 8 ? "paid" : "unpaid",
    })
  );
  const smRows = [
    staff({
      id: "sm-1",
      display_name: "SM Staff 01",
      branch_id: "branch-sm",
      branch_name: "SM Branch",
      status: "unpaid",
    }),
    staff({
      id: "sm-2",
      display_name: "SM Staff 02",
      branch_id: "branch-sm",
      branch_name: "SM Branch",
      status: "unpaid",
    }),
  ];

  return [...mainRows, ...smRows];
}

beforeEach(() => {
  refreshMock.mockClear();
  markPaidMock.mockClear();
  markUnpaidMock.mockClear();
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe("EmployeePayrollTable state behavior", () => {
  it("resets pagination to page 1 when the branch tab changes", () => {
    renderTable(mixedRows());

    fireEvent.click(screen.getByLabelText("Go to next staff page"));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "SM Branch, 2 staff" }));

    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText("Showing 1-2 of 2 staff in SM Branch")).toBeTruthy();
  });

  it("resets pagination to page 1 when the status filter changes", () => {
    renderTable(mixedRows());

    fireEvent.click(screen.getByLabelText("Go to next staff page"));
    fireEvent.change(screen.getByLabelText("Filter payroll status"), {
      target: { value: "paid" },
    });

    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText("Showing 1-1 of 1 staff")).toBeTruthy();
  });

  it("resets pagination to page 1 when search changes", () => {
    renderTable(mixedRows());

    fireEvent.click(screen.getByLabelText("Go to next staff page"));
    fireEvent.change(screen.getByLabelText("Search employees"), {
      target: { value: "SM Staff" },
    });

    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText("Showing 1-2 of 2 staff")).toBeTruthy();
  });

  it("preserves active branch and status filter after marking a staff member paid", async () => {
    const onStatusChanged = vi.fn();
    renderTable(mixedRows(), onStatusChanged);

    const smTab = screen.getByRole("tab", { name: "SM Branch, 2 staff" });
    fireEvent.click(smTab);
    fireEvent.change(screen.getByLabelText("Filter payroll status"), {
      target: { value: "unpaid" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Mark Paid" })[0]!);

    await waitFor(() => expect(markPaidMock).toHaveBeenCalledWith("sm-1"));
    expect(smTab.getAttribute("aria-selected")).toBe("true");
    expect((screen.getByLabelText("Filter payroll status") as HTMLSelectElement).value).toBe("unpaid");
    expect(onStatusChanged).toHaveBeenCalledWith("sm-1", "paid");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the same paginated dataset for the desktop table and mobile cards", () => {
    const { container } = renderTable(mixedRows());

    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(container.querySelectorAll("article")).toHaveLength(8);
    expect(screen.queryByText("Main Staff 09")).toBeNull();
  });
});

describe("PayrollPageClient global summary behavior", () => {
  it("keeps summary cards global when a branch tab changes", () => {
    const dashboard: PayrollDashboardData = {
      settings: DEFAULT_PAYROLL_SETTINGS,
      payrollMonth: { start: "2026-06-01", end: "2026-06-30" },
      currentPeriodId: "period-1",
      summary: {
        nextPayrollDateLabel: "June 30, 2026",
        nextPayrollPreviewLabel: "2026-06-30",
        countdownLabel: "In 15 days",
        totalMonthlyPayroll: 30000,
        paidStaff: 1,
        unpaidStaff: 2,
        totalIncludedStaff: 3,
        payrollProgress: 33,
        reminderMessage: null,
      },
      branches,
      staffRows: [
        staff({ id: "main", display_name: "Main Staff", monthly_pay: 10000 }),
        staff({
          id: "sm-1",
          display_name: "SM Staff 01",
          branch_id: "branch-sm",
          branch_name: "SM Branch",
          monthly_pay: 10000,
        }),
        staff({
          id: "sm-2",
          display_name: "SM Staff 02",
          branch_id: "branch-sm",
          branch_name: "SM Branch",
          monthly_pay: 10000,
          status: "paid",
        }),
      ],
      history: [],
    };

    render(<PayrollPageClient dashboard={dashboard} />);
    const summary = screen.getByLabelText("Payroll summary");

    expect(within(summary).getByText("Total Monthly Payroll")).toBeTruthy();
    expect(within(summary).getByText("₱30,000")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "SM Branch, 2 staff" }));

    expect(within(summary).getByText("Total Monthly Payroll")).toBeTruthy();
    expect(within(summary).getByText("₱30,000")).toBeTruthy();
    expect(within(summary).getByText("1")).toBeTruthy();
    expect(within(summary).getByText("2")).toBeTruthy();
  });
});
