import { describe, expect, it } from "vitest";
import {
  ALL_PAYROLL_STAFF_TAB,
  DEFAULT_PAYROLL_STAFF_PAGE_SIZE,
  UNASSIGNED_PAYROLL_STAFF_TAB,
  buildPayrollBranchTabs,
  clampPayrollStaffPage,
  derivePayrollStaffListView,
  getPayrollBranchTabValue,
  sortPayrollStaffRows,
  type PayrollStaffStatusFilter,
} from "../../../src/lib/payroll/staff-list";
import type {
  PayrollDashboardBranch,
  PayrollDashboardStaffRow,
} from "../../../src/lib/queries/payroll";

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

function derive(
  staffRows: PayrollDashboardStaffRow[],
  overrides: Partial<{
    selectedBranchTab: string;
    query: string;
    statusFilter: PayrollStaffStatusFilter;
    page: number;
    pageSize: number;
  }> = {}
) {
  return derivePayrollStaffListView({
    staffRows,
    branches,
    selectedBranchTab: overrides.selectedBranchTab ?? ALL_PAYROLL_STAFF_TAB,
    query: overrides.query ?? "",
    statusFilter: overrides.statusFilter ?? "all",
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? DEFAULT_PAYROLL_STAFF_PAGE_SIZE,
  });
}

describe("payroll staff list derivation", () => {
  it("keeps All Staff first and includes all eligible staff", () => {
    const rows = [
      staff({ id: "a", display_name: "Ana" }),
      staff({ id: "b", display_name: "Bea", branch_id: "branch-sm", branch_name: "SM Branch" }),
    ];

    const view = derive(rows);

    expect(view.tabs[0]).toMatchObject({ value: ALL_PAYROLL_STAFF_TAB, label: "All Staff", count: 2 });
    expect(view.filteredRows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("filters a selected active branch correctly", () => {
    const rows = [
      staff({ id: "main", display_name: "Main Staff" }),
      staff({ id: "sm", display_name: "SM Staff", branch_id: "branch-sm", branch_name: "SM Branch" }),
    ];

    const view = derive(rows, { selectedBranchTab: getPayrollBranchTabValue("branch-sm") });

    expect(view.filteredRows.map((row) => row.id)).toEqual(["sm"]);
    expect(view.selectedBranchLabel).toBe("SM Branch");
  });

  it("calculates branch tab counts from the current payroll staff dataset", () => {
    const rows = [
      staff({ id: "main-1", display_name: "Main One" }),
      staff({ id: "main-2", display_name: "Main Two" }),
      staff({ id: "sm-1", display_name: "SM One", branch_id: "branch-sm", branch_name: "SM Branch" }),
    ];

    const tabs = buildPayrollBranchTabs(rows, branches);

    expect(tabs.map((tab) => [tab.label, tab.count])).toEqual([
      ["All Staff", 3],
      ["Main Branch", 2],
      ["SM Branch", 1],
    ]);
  });

  it("keeps unassigned staff visible in All Staff and exposes an Unassigned tab only when needed", () => {
    const rows = [
      staff({ id: "main", display_name: "Main Staff" }),
      staff({
        id: "unassigned",
        display_name: "Unassigned Staff",
        branch_id: null,
        branch_name: null,
      }),
    ];

    const allView = derive(rows);
    const unassignedView = derive(rows, { selectedBranchTab: UNASSIGNED_PAYROLL_STAFF_TAB });

    expect(allView.filteredRows.map((row) => row.id)).toContain("unassigned");
    expect(allView.tabs.find((tab) => tab.value === UNASSIGNED_PAYROLL_STAFF_TAB)).toMatchObject({
      label: "Unassigned",
      count: 1,
    });
    expect(unassignedView.filteredRows.map((row) => row.id)).toEqual(["unassigned"]);
  });

  it("returns only the requested paginated staff slice", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      staff({ id: `staff-${index + 1}`, display_name: `Staff ${String(index + 1).padStart(2, "0")}` })
    );

    const view = derive(rows, { page: 2, pageSize: 8 });

    expect(view.visibleRows.map((row) => row.id)).toEqual(["staff-9", "staff-10"]);
    expect(view.totalRows).toBe(10);
  });

  it("sorts missing pay setup, unpaid, paid, then display name and id", () => {
    const rows = [
      staff({ id: "paid-b", display_name: "Bea", status: "paid" }),
      staff({ id: "unpaid-c", display_name: "Cara", status: "unpaid" }),
      staff({ id: "missing-z", display_name: "Zara", status: "missing_salary", has_monthly_pay: false }),
      staff({ id: "unpaid-a2", display_name: "Ana", status: "unpaid" }),
      staff({ id: "unpaid-a1", display_name: "Ana", status: "unpaid" }),
    ];

    expect(sortPayrollStaffRows(rows).map((row) => row.id)).toEqual([
      "missing-z",
      "unpaid-a1",
      "unpaid-a2",
      "unpaid-c",
      "paid-b",
    ]);
  });

  it("sorts before pagination instead of sorting each page independently", () => {
    const paidRows = Array.from({ length: 8 }, (_, index) =>
      staff({ id: `paid-${index}`, display_name: `Paid ${index}`, status: "paid" })
    );
    const missingPayRow = staff({
      id: "missing-last-input",
      display_name: "Zed Setup",
      status: "missing_salary",
      has_monthly_pay: false,
    });

    const view = derive([...paidRows, missingPayRow], { page: 1, pageSize: 8 });

    expect(view.visibleRows[0]?.id).toBe("missing-last-input");
  });

  it("combines branch, search, and status filters in the required order", () => {
    const rows = [
      staff({ id: "main-ana", display_name: "Ana", status: "unpaid" }),
      staff({
        id: "sm-ana-paid",
        display_name: "Ana SM",
        status: "paid",
        branch_id: "branch-sm",
        branch_name: "SM Branch",
      }),
      staff({
        id: "sm-ana-unpaid",
        display_name: "Ana Unpaid",
        status: "unpaid",
        branch_id: "branch-sm",
        branch_name: "SM Branch",
      }),
    ];

    const view = derive(rows, {
      selectedBranchTab: getPayrollBranchTabValue("branch-sm"),
      query: "ana",
      statusFilter: "unpaid",
    });

    expect(view.filteredRows.map((row) => row.id)).toEqual(["sm-ana-unpaid"]);
  });

  it("clamps an empty final page to the nearest valid previous page", () => {
    expect(clampPayrollStaffPage(3, 8, 8)).toBe(1);
    expect(clampPayrollStaffPage(3, 14, 8)).toBe(2);
  });

  it("preserves active branch and filter values while deriving a post-mutation view", () => {
    const selectedBranchTab = getPayrollBranchTabValue("branch-sm");
    const rows = [
      staff({
        id: "sm-paid",
        display_name: "SM Paid",
        status: "paid",
        branch_id: "branch-sm",
        branch_name: "SM Branch",
      }),
    ];

    const view = derive(rows, {
      selectedBranchTab,
      statusFilter: "unpaid",
      page: 2,
      pageSize: 8,
    });

    expect(view.selectedBranchTab).toBe(selectedBranchTab);
    expect(view.selectedBranchLabel).toBe("SM Branch");
    expect(view.filteredRows).toEqual([]);
    expect(view.currentPage).toBe(1);
  });
});
