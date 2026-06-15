import type { PayrollDashboardBranch, PayrollDashboardStaffRow } from "@/lib/queries/payroll";

export const ALL_PAYROLL_STAFF_TAB = "all";
export const UNASSIGNED_PAYROLL_STAFF_TAB = "unassigned";
export const DEFAULT_PAYROLL_STAFF_PAGE_SIZE = 8;
export const PAYROLL_STAFF_PAGE_SIZE_OPTIONS = [8, 12, 20] as const;

export type PayrollStaffStatusFilter = "all" | PayrollDashboardStaffRow["status"];

export type PayrollBranchTab = {
  value: string;
  label: string;
  count: number;
  branchId: string | null;
};

export type PayrollStaffListView = {
  tabs: PayrollBranchTab[];
  selectedBranchTab: string;
  selectedBranchLabel: string | null;
  filteredRows: PayrollDashboardStaffRow[];
  visibleRows: PayrollDashboardStaffRow[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
};

type PayrollStaffListInput = {
  staffRows: PayrollDashboardStaffRow[];
  branches: PayrollDashboardBranch[];
  selectedBranchTab: string;
  query: string;
  statusFilter: PayrollStaffStatusFilter;
  page: number;
  pageSize: number;
};

export function getPayrollBranchTabValue(branchId: string): string {
  return `branch:${branchId}`;
}

export function normalizePayrollStaffPageSize(pageSize: number): number {
  return PAYROLL_STAFF_PAGE_SIZE_OPTIONS.includes(
    pageSize as (typeof PAYROLL_STAFF_PAGE_SIZE_OPTIONS)[number]
  )
    ? pageSize
    : DEFAULT_PAYROLL_STAFF_PAGE_SIZE;
}

export function clampPayrollStaffPage(page: number, totalRows: number, pageSize: number): number {
  const normalizedPageSize = normalizePayrollStaffPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRows / normalizedPageSize));
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), totalPages);
}

export function buildPayrollBranchTabs(
  staffRows: PayrollDashboardStaffRow[],
  branches: PayrollDashboardBranch[]
): PayrollBranchTab[] {
  const branchCounts = new Map(branches.map((branch) => [branch.id, 0]));
  let unassignedCount = 0;

  for (const row of staffRows) {
    if (!row.branch_id) {
      unassignedCount += 1;
      continue;
    }

    if (branchCounts.has(row.branch_id)) {
      branchCounts.set(row.branch_id, (branchCounts.get(row.branch_id) ?? 0) + 1);
    }
  }

  const tabs: PayrollBranchTab[] = [
    {
      value: ALL_PAYROLL_STAFF_TAB,
      label: "All Staff",
      count: staffRows.length,
      branchId: null,
    },
    ...branches.map((branch) => ({
      value: getPayrollBranchTabValue(branch.id),
      label: branch.name,
      count: branchCounts.get(branch.id) ?? 0,
      branchId: branch.id,
    })),
  ];

  if (unassignedCount > 0) {
    tabs.push({
      value: UNASSIGNED_PAYROLL_STAFF_TAB,
      label: "Unassigned",
      count: unassignedCount,
      branchId: null,
    });
  }

  return tabs;
}

export function sortPayrollStaffRows(
  rows: PayrollDashboardStaffRow[]
): PayrollDashboardStaffRow[] {
  const priority = { missing_salary: 0, unpaid: 1, paid: 2 } as const;

  return [...rows].sort((a, b) => {
    const byStatus = priority[a.status] - priority[b.status];
    if (byStatus !== 0) return byStatus;

    const byName = a.display_name.localeCompare(b.display_name, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;

    return a.id.localeCompare(b.id);
  });
}

export function filterPayrollStaffRows({
  staffRows,
  selectedBranchTab,
  query,
  statusFilter,
}: Pick<
  PayrollStaffListInput,
  "staffRows" | "selectedBranchTab" | "query" | "statusFilter"
>): PayrollDashboardStaffRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const branchId = selectedBranchTab.startsWith("branch:")
    ? selectedBranchTab.slice("branch:".length)
    : null;

  const branchFiltered = staffRows.filter((row) => {
    if (selectedBranchTab === ALL_PAYROLL_STAFF_TAB) return true;
    if (selectedBranchTab === UNASSIGNED_PAYROLL_STAFF_TAB) return !row.branch_id;
    return Boolean(branchId) && row.branch_id === branchId;
  });

  const searchFiltered = branchFiltered.filter((row) => {
    if (!normalizedQuery) return true;
    return [
      row.display_name,
      row.full_name,
      row.nickname,
      row.role_label,
      row.branch_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const statusFiltered = searchFiltered.filter(
    (row) => statusFilter === "all" || row.status === statusFilter
  );

  return sortPayrollStaffRows(statusFiltered);
}

export function derivePayrollStaffListView(input: PayrollStaffListInput): PayrollStaffListView {
  const tabs = buildPayrollBranchTabs(input.staffRows, input.branches);
  const selectedBranchTab = tabs.some((tab) => tab.value === input.selectedBranchTab)
    ? input.selectedBranchTab
    : ALL_PAYROLL_STAFF_TAB;
  const selectedTab = tabs.find((tab) => tab.value === selectedBranchTab) ?? tabs[0]!;
  const pageSize = normalizePayrollStaffPageSize(input.pageSize);
  const filteredRows = filterPayrollStaffRows({
    staffRows: input.staffRows,
    selectedBranchTab,
    query: input.query,
    statusFilter: input.statusFilter,
  });
  const totalRows = filteredRows.length;
  const currentPage = clampPayrollStaffPage(input.page, totalRows, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = totalRows === 0 ? 0 : Math.min(startIndex + pageSize, totalRows);

  return {
    tabs,
    selectedBranchTab,
    selectedBranchLabel:
      selectedBranchTab === ALL_PAYROLL_STAFF_TAB ? null : selectedTab.label,
    filteredRows,
    visibleRows: filteredRows.slice(startIndex, endIndex),
    totalRows,
    currentPage,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
  };
}

export function formatPayrollStaffResultSummary(view: PayrollStaffListView): string {
  const range =
    view.totalRows === 0 ? "Showing 0 of 0" : `Showing ${view.startIndex + 1}-${view.endIndex} of ${view.totalRows}`;
  const branchSuffix = view.selectedBranchLabel ? ` in ${view.selectedBranchLabel}` : "";
  return `${range} staff${branchSuffix}`;
}
