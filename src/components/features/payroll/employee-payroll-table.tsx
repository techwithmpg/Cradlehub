"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  markStaffPayrollPaidAction,
  markStaffPayrollUnpaidAction,
} from "@/lib/actions/payroll-dashboard-actions";
import {
  ALL_PAYROLL_STAFF_TAB,
  PAYROLL_STAFF_PAGE_SIZE_OPTIONS,
  derivePayrollStaffListView,
  formatPayrollStaffResultSummary,
  type PayrollBranchTab,
  type PayrollStaffListView,
  type PayrollStaffStatusFilter,
} from "@/lib/payroll/staff-list";
import type {
  PayrollDashboardBranch,
  PayrollDashboardStaffRow,
} from "@/lib/queries/payroll";
import {
  fieldLabelClass,
  formatPayrollMoney,
  inputClass,
  outlinePayrollButtonClass,
  PayrollStatusBadge,
  primaryPayrollButtonClass,
  selectClass,
  StaffPayrollAvatar,
} from "./payroll-ui";

export function EmployeePayrollTable({
  staffRows,
  branches,
  allowStatusEditing,
  onSetupPay,
}: {
  staffRows: PayrollDashboardStaffRow[];
  branches: PayrollDashboardBranch[];
  allowStatusEditing: boolean;
  onSetupPay: (staffId: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayrollStaffStatusFilter>("all");
  const [selectedBranchTab, setSelectedBranchTab] = useState(ALL_PAYROLL_STAFF_TAB);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedRow, setSelectedRow] = useState<PayrollDashboardStaffRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const view = useMemo(
    () =>
      derivePayrollStaffListView({
        staffRows,
        branches,
        selectedBranchTab,
        query,
        statusFilter,
        page,
        pageSize,
      }),
    [branches, page, pageSize, query, selectedBranchTab, staffRows, statusFilter]
  );

  function resetToFirstPage() {
    setPage(1);
  }

  function markPaid(row: PayrollDashboardStaffRow) {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const result = await markStaffPayrollPaidAction(row.id);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function markUnpaid(row: PayrollDashboardStaffRow) {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const result = await markStaffPayrollUnpaidAction(row.id);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelectedRow(null);
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-sm"
      aria-labelledby="employee-payroll-heading"
    >
      <div className="border-b border-[var(--cs-border-soft)] p-4">
        <div>
          <h2 id="employee-payroll-heading" className="font-heading text-xl font-semibold text-[var(--cs-text)]">
            Employee Payroll
          </h2>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Monthly salary tracking for the next payroll period.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <PayrollBranchTabs
            tabs={view.tabs}
            value={view.selectedBranchTab}
            onValueChange={(value) => {
              setSelectedBranchTab(value);
              resetToFirstPage();
            }}
          />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-[var(--cs-text-muted)]">
              {view.selectedBranchLabel
                ? `Viewing ${view.selectedBranchLabel} staff`
                : "Viewing all payroll staff"}
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px] lg:w-[29rem]">
              <label className="relative block">
                <span className="sr-only">Search employees</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-subtle)]" />
                <input
                  className={`${inputClass} pl-9`}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    resetToFirstPage();
                  }}
                  placeholder="Search staff"
                />
              </label>
              <label>
                <span className="sr-only">Filter payroll status</span>
                <select
                  className={selectClass}
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as PayrollStaffStatusFilter);
                    resetToFirstPage();
                  }}
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="missing_salary">Pay setup needed</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-[var(--cs-error-bg)] px-3 py-2 text-sm text-[var(--cs-error-text)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="hidden lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
              {["Employee", "Role", "Monthly Pay", "Status", "Last Paid", "Action"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--cs-border-soft)] last:border-0">
                <td className="px-4 py-3">
                  <EmployeeIdentity row={row} />
                </td>
                <td className="px-4 py-3 text-sm text-[var(--cs-text)]">{row.role_label}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[var(--cs-text)]">
                  {row.has_monthly_pay ? formatPayrollMoney(row.monthly_pay) : "Not set"}
                </td>
                <td className="px-4 py-3">
                  <PayrollStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-sm text-[var(--cs-text-muted)]">{row.last_paid_label}</td>
                <td className="px-4 py-3">
                  <RowAction
                    row={row}
                    allowStatusEditing={allowStatusEditing}
                    pending={pending && pendingId === row.id}
                    onMarkPaid={() => markPaid(row)}
                    onView={() => setSelectedRow(row)}
                    onSetupPay={() => onSetupPay(row.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 lg:hidden">
        {view.visibleRows.map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <EmployeeIdentity row={row} />
              <PayrollStatusBadge status={row.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className={fieldLabelClass}>Role</dt>
                <dd className="text-[var(--cs-text)]">{row.role_label}</dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Branch</dt>
                <dd className="text-[var(--cs-text)]">{getStaffBranchLabel(row)}</dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Monthly Pay</dt>
                <dd className="font-semibold text-[var(--cs-text)]">
                  {row.has_monthly_pay ? formatPayrollMoney(row.monthly_pay) : "Not set"}
                </dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Last Paid</dt>
                <dd className="text-[var(--cs-text)]">{row.last_paid_label}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <RowAction
                row={row}
                allowStatusEditing={allowStatusEditing}
                pending={pending && pendingId === row.id}
                onMarkPaid={() => markPaid(row)}
                onView={() => setSelectedRow(row)}
                onSetupPay={() => onSetupPay(row.id)}
                fullWidth
              />
            </div>
          </article>
        ))}
      </div>

      {view.totalRows === 0 ? (
        <div className="border-t border-[var(--cs-border-soft)] px-4 py-10 text-center text-sm text-[var(--cs-text-muted)]">
          No staff match the current filters.
        </div>
      ) : null}

      <PayrollStaffPagination
        view={view}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          resetToFirstPage();
        }}
        onPrevious={() => setPage(Math.max(1, view.currentPage - 1))}
        onNext={() => setPage(Math.min(view.totalPages, view.currentPage + 1))}
      />

      <EmployeePaymentDialog
        row={selectedRow}
        open={selectedRow !== null}
        allowStatusEditing={allowStatusEditing}
        pending={pending && selectedRow !== null && pendingId === selectedRow.id}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
        onMarkUnpaid={() => {
          if (selectedRow) markUnpaid(selectedRow);
        }}
      />
    </section>
  );
}

function PayrollBranchTabs({
  tabs,
  value,
  onValueChange,
}: {
  tabs: PayrollBranchTab[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const activeTab = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-payroll-branch-tab]")
    ).find((element) => element.dataset.payrollBranchTab === value);
    activeTab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <Tabs value={value} onValueChange={(nextValue) => onValueChange(String(nextValue))}>
      <div
        ref={scrollerRef}
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabsList
          variant="line"
          aria-label="Payroll staff branches"
          className="min-w-max justify-start border-b border-[var(--cs-border-soft)] p-0"
        >
          {tabs.map((tab) => {
            const isActive = tab.value === value;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-payroll-branch-tab={tab.value}
                aria-label={`${tab.label}, ${tab.count} staff`}
                className="h-9 flex-none px-3 py-2 text-[var(--cs-text-muted)] data-active:text-[var(--cs-success-text)] data-active:after:bg-[var(--cs-success-text)]"
              >
                <span>{tab.label}</span>
                <span
                  className={[
                    "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    isActive
                      ? "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
                      : "bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]",
                  ].join(" ")}
                >
                  {tab.count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}

function PayrollStaffPagination({
  view,
  onPageSizeChange,
  onPrevious,
  onNext,
}: {
  view: PayrollStaffListView;
  onPageSizeChange: (pageSize: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const disablePrevious = view.currentPage <= 1;
  const disableNext = view.currentPage >= view.totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--cs-border-soft)] px-4 py-3 text-sm text-[var(--cs-text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">{formatPayrollStaffResultSummary(view)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Staff per page</span>
          <select
            className="h-8 rounded-md border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-2 text-xs text-[var(--cs-text)]"
            value={view.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAYROLL_STAFF_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          className={outlinePayrollButtonClass}
          disabled={disablePrevious}
          aria-label="Go to previous staff page"
          onClick={onPrevious}
        >
          Previous
        </Button>
        <span aria-live="polite" className="min-w-24 text-center text-xs text-[var(--cs-text-muted)]">
          Page {view.currentPage} of {view.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          className={outlinePayrollButtonClass}
          disabled={disableNext}
          aria-label="Go to next staff page"
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function EmployeeIdentity({ row }: { row: PayrollDashboardStaffRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StaffPayrollAvatar staff={row} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-[var(--cs-text)]">{row.display_name}</p>
        <p className="truncate text-sm text-[var(--cs-text-muted)]">{getStaffBranchLabel(row)}</p>
      </div>
    </div>
  );
}

function getStaffBranchLabel(row: PayrollDashboardStaffRow): string {
  return row.branch_name?.trim() || "Unassigned";
}

function RowAction({
  row,
  allowStatusEditing,
  pending,
  fullWidth,
  onMarkPaid,
  onView,
  onSetupPay,
}: {
  row: PayrollDashboardStaffRow;
  allowStatusEditing: boolean;
  pending: boolean;
  fullWidth?: boolean;
  onMarkPaid: () => void;
  onView: () => void;
  onSetupPay: () => void;
}) {
  const className = fullWidth ? "w-full" : "";

  if (row.status === "paid") {
    return (
      <Button
        type="button"
        variant="outline"
        className={`${outlinePayrollButtonClass} ${className}`}
        onClick={onView}
      >
        <Eye className="size-4" aria-hidden="true" />
        View
      </Button>
    );
  }

  if (row.status === "missing_salary") {
    return (
      <Button
        type="button"
        variant="outline"
        className={`${outlinePayrollButtonClass} ${className}`}
        onClick={onSetupPay}
      >
        Set Pay
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className={`${primaryPayrollButtonClass} ${className}`}
      disabled={!allowStatusEditing || pending}
      onClick={onMarkPaid}
    >
      {pending ? "Marking..." : "Mark Paid"}
    </Button>
  );
}

function EmployeePaymentDialog({
  row,
  open,
  allowStatusEditing,
  pending,
  onOpenChange,
  onMarkUnpaid,
}: {
  row: PayrollDashboardStaffRow | null;
  open: boolean;
  allowStatusEditing: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkUnpaid: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-md rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]"
      >
        {row ? (
          <div className="space-y-5">
            <div>
              <DialogTitle className="font-heading text-xl font-semibold text-[var(--cs-text)]">
                {row.display_name}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[var(--cs-text-muted)]">
                Payroll payment detail for the current monthly period.
              </DialogDescription>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-[var(--cs-surface-warm)] p-4 text-sm">
              <div>
                <dt className={fieldLabelClass}>Role</dt>
                <dd className="font-medium text-[var(--cs-text)]">{row.role_label}</dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Status</dt>
                <dd>
                  <PayrollStatusBadge status={row.status} />
                </dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Branch</dt>
                <dd className="font-medium text-[var(--cs-text)]">{getStaffBranchLabel(row)}</dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Monthly Pay</dt>
                <dd className="font-semibold text-[var(--cs-success-text)]">
                  {formatPayrollMoney(row.monthly_pay)}
                </dd>
              </div>
              <div>
                <dt className={fieldLabelClass}>Last Paid</dt>
                <dd className="font-medium text-[var(--cs-text)]">{row.last_paid_label}</dd>
              </div>
            </dl>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={outlinePayrollButtonClass}
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="bg-[var(--cs-error-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-error-text)]/90"
                disabled={!allowStatusEditing || pending}
                onClick={onMarkUnpaid}
              >
                {pending ? "Updating..." : "Mark Unpaid"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
