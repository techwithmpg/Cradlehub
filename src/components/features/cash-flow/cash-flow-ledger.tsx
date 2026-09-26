"use client";

import { useId, useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Equal,
  Clock,
  Search,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Home,
  CreditCard,
  ShoppingCart,
  Gift,
  UserCheck,
  Users,
  Percent,
  Wallet,
  ArrowLeftRight,
  Undo2,
  SlidersHorizontal,
  Plus,
  Eye,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
} from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import {
  filterCashFlowEntries,
  EMPTY_CASH_FLOW_FILTERS,
  type CashFlowEntry,
  type CashFlowFilters,
  type CashFlowRange,
} from "@/lib/cash-flow/read-model";
import {
  CashFlowMetric,
  CashFlowStatus,
  compactFieldClass,
  peso,
} from "./cash-flow-ui";

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "booking", label: "Booking" },
  { value: "home_service", label: "Home Service" },
  { value: "payment", label: "Payment" },
  { value: "expense", label: "Expense" },
  { value: "tip", label: "Tip" },
  { value: "staff_advance", label: "Staff Advance" },
  { value: "payroll", label: "Payroll" },
  { value: "commission_payout", label: "Commission Payout" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "transfer", label: "Transfer" },
  { value: "refund", label: "Refund" },
  { value: "adjustment", label: "Adjustment" },
  { value: "misc_income", label: "Misc Income" },
] as const;

function getCategoryIcon(category: string) {
  switch (category) {
    case "home_service":
      return <Home className="size-3.5 text-[#C4966E]" />;
    case "payment":
      return <CreditCard className="size-3.5 text-blue-600" />;
    case "expense":
      return <ShoppingCart className="size-3.5 text-rose-600" />;
    case "tip":
      return <Gift className="size-3.5 text-pink-600" />;
    case "staff_advance":
      return <UserCheck className="size-3.5 text-neutral-600" />;
    case "payroll":
      return <Users className="size-3.5 text-neutral-600" />;
    case "commission_payout":
      return <Percent className="size-3.5 text-neutral-600" />;
    case "petty_cash":
      return <Wallet className="size-3.5 text-amber-600" />;
    case "transfer":
      return <ArrowLeftRight className="size-3.5 text-neutral-600" />;
    case "refund":
      return <Undo2 className="size-3.5 text-rose-600" />;
    case "adjustment":
      return <SlidersHorizontal className="size-3.5 text-sky-600" />;
    case "misc_income":
      return <Plus className="size-3.5 text-emerald-600" />;
    case "booking":
    default:
      return <Calendar className="size-3.5 text-neutral-600" />;
  }
}

export function CashFlowLedger({
  entries,
  range,
  onRangeChange,
  onSelect,
  date = "",
  onNewEntry,
  onCorrectEntry,
  onAddRelatedEntry,
}: {
  entries: CashFlowEntry[];
  range?: CashFlowRange;
  onRangeChange?: (range: CashFlowRange) => void;
  onSelect: (entry: CashFlowEntry) => void;
  date?: string;
  onNewEntry?: () => void;
  onCorrectEntry?: (entry: CashFlowEntry) => void;
  onAddRelatedEntry?: (entry: CashFlowEntry) => void;
}) {
  const fromInputId = useId();
  const throughInputId = useId();

  const [dateRange, setDateRange] = useState<CashFlowRange>({
    from: range?.from ?? date,
    to: range?.to ?? date,
  });

  const [filters, setFilters] = useState<CashFlowFilters & { category: string }>({
    ...EMPTY_CASH_FLOW_FILTERS,
    category: "",
    date,
  });

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  function changeFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  }

  const handleDateChange = (field: "from" | "to", val: string) => {
    const updated = { ...dateRange, [field]: val };
    setDateRange(updated);
    if (onRangeChange && updated.from && updated.to && updated.from <= updated.to) {
      onRangeChange(updated);
    }
  };

  // Filter entries based on search, date, source, category, method, status
  const filtered = useMemo(() => {
    let result = filterCashFlowEntries(entries, filters);

    // Apply date range filter if date range is active and individual date is empty
    if (!filters.date && dateRange.from && dateRange.to) {
      result = result.filter(
        (e) => e.date >= dateRange.from && e.date <= dateRange.to
      );
    }

    if (filters.category) {
      if (filters.category === "booking") {
        result = result.filter((e) => e.source === "booking");
      } else if (filters.category === "home_service") {
        result = result.filter((e) => e.source === "home_service");
      } else if (filters.category === "payment") {
        result = result.filter((e) => e.amount > 0);
      } else if (filters.category === "refund") {
        result = result.filter((e) => e.paymentStatus === "refunded");
      } else {
        result = [];
      }
    }

    return result;
  }, [entries, filters, dateRange]);

  // Compute KPI totals from real ledger entries
  const { totalInflow, totalOutflow, netFlow, totalUnreconciled, unreconciledCount } =
    useMemo(() => {
      let inflow = 0;
      let outflow = 0;
      let unreconciled = 0;
      let unrecCount = 0;

      for (const entry of entries) {
        const isPendingPayOnSite =
          entry.method === "pay_on_site" && entry.paymentStatus !== "paid";

        if (entry.paymentStatus === "refunded") {
          outflow += entry.amount;
        } else if (!isPendingPayOnSite && entry.amount > 0) {
          inflow += entry.amount;
        }

        if (
          entry.outstanding > 0 ||
          entry.paymentStatus === "pending" ||
          entry.paymentStatus === "unpaid" ||
          isPendingPayOnSite
        ) {
          unreconciled += entry.outstanding || entry.payable || entry.amount;
          unrecCount++;
        }
      }

      return {
        totalInflow: inflow,
        totalOutflow: outflow,
        netFlow: inflow - outflow,
        totalUnreconciled: unreconciled,
        unreconciledCount: unrecCount,
      };
    }, [entries]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIdx = currentPage * pageSize;
  const paginatedEntries = filtered.slice(startIdx, startIdx + pageSize);

  function exportLedgerCsv() {
    const headers = [
      "Date",
      "Time",
      "Reference",
      "Customer",
      "Service",
      "Category",
      "Method",
      "Inflow",
      "Outflow",
      "Net Effect",
      "Status",
    ];

    const rows = filtered.map((e) => {
      const isRefunded = e.paymentStatus === "refunded";
      const isPendingPayOnSite =
        e.method === "pay_on_site" && e.paymentStatus !== "paid";
      const inflow =
        !isRefunded && !isPendingPayOnSite && e.amount > 0 ? e.amount : 0;
      const outflow = isRefunded ? e.amount : 0;
      const net = inflow - outflow;
      const category = e.source === "home_service" ? "Home Service" : "Booking";
      const ref =
        e.reference ||
        `${e.source === "home_service" ? "HS" : "BK"}-${e.date.replace(/-/g, "")}-${e.id.slice(0, 3).toUpperCase()}`;

      return [
        `"${e.date}"`,
        `"${e.time}"`,
        `"${ref}"`,
        `"${e.customer.replace(/"/g, '""')}"`,
        `"${e.service.replace(/"/g, '""')}"`,
        `"${category}"`,
        `"${e.method}"`,
        inflow.toFixed(2),
        outflow.toFixed(2),
        net.toFixed(2),
        `"${isPendingPayOnSite ? "pending" : e.paymentStatus}"`,
      ].join(",");
    });

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* TOP KPI ROW: 4 Compact Metric Cards */}
      <section
        aria-label="Ledger KPI summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <CashFlowMetric
          compact
          label="Inflow"
          value={peso(totalInflow)}
          detail="Total money received"
          icon={<ArrowUp className="size-3.5" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-200"
          dotTone="green"
        />

        <CashFlowMetric
          compact
          label="Outflow"
          value={peso(totalOutflow)}
          detail="Total money paid out"
          icon={<ArrowDown className="size-3.5" />}
          iconBg="bg-rose-50 text-rose-700 border-rose-200"
          dotTone="coral"
        />

        <CashFlowMetric
          compact
          label="Net Flow"
          value={peso(netFlow)}
          detail="Inflow minus outflow"
          icon={<Equal className="size-3.5" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-200"
          dotTone="green"
        />

        <CashFlowMetric
          compact
          label="Unreconciled"
          value={peso(totalUnreconciled)}
          detail={`${unreconciledCount} transactions requiring review`}
          icon={<Clock className="size-3.5" />}
          iconBg="bg-[#FBF6EE] text-[#8A6347] border-[#EAE4DC]"
          dotTone="sand"
        />
      </section>

      {/* ONE UNIFIED LEDGER CARD: Title + Filters + Table + Pagination */}
      <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold text-[var(--cs-text)]">Ledger</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
              Complete financial ledger of all transactions.{" "}
              <span role="status" className="font-semibold text-[var(--cs-text)]">
                {filtered.length} records found.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNewEntry && (
              <Button
                size="sm"
                className="h-8 rounded-lg bg-[#1b4332] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#16382a]"
                onClick={onNewEntry}
              >
                <Plus className="mr-1.5 size-3.5 stroke-[2.5]" />
                New Entry
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] shadow-xs"
              onClick={exportLedgerCsv}
            >
              <Download className="mr-1.5 size-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="size-8 rounded-lg border-[var(--cs-border)] bg-white p-0 text-[var(--cs-text-muted)] shadow-xs"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filter Row inside the SAME card */}
        <div className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/30 px-5 py-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6 items-end">
            {/* Search */}
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Search
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--cs-text-muted)]" />
                <input
                  aria-label="Search"
                  className={`${compactFieldClass} pl-8`}
                  placeholder="Customer, reference, description..."
                  value={filters.search}
                  onChange={(e) => changeFilter("search", e.target.value)}
                />
              </div>
            </label>

            {/* Date range */}
            <div className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              <span>Date range</span>
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs text-[var(--cs-text)] shadow-xs focus-within:border-[var(--cs-sand)] focus-within:ring-2 focus-within:ring-[var(--cs-sand)]/15">
                <label htmlFor={fromInputId} className="sr-only">
                  From
                </label>
                <input
                  id={fromInputId}
                  aria-label="From"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => handleDateChange("from", e.target.value)}
                  className="w-23 border-0 bg-transparent p-0 text-xs font-medium text-[var(--cs-text)] outline-none"
                />
                <span className="text-[var(--cs-text-muted)] font-normal">→</span>
                <label htmlFor={throughInputId} className="sr-only">
                  Through
                </label>
                <input
                  id={throughInputId}
                  aria-label="Through"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => handleDateChange("to", e.target.value)}
                  className="w-23 border-0 bg-transparent p-0 text-xs font-medium text-[var(--cs-text)] outline-none"
                />
                <Calendar className="size-3.5 shrink-0 text-[var(--cs-text-muted)]" />
              </div>
            </div>

            {/* Source */}
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Source
              <select
                aria-label="Source"
                className={compactFieldClass}
                value={filters.source}
                onChange={(e) => changeFilter("source", e.target.value)}
              >
                <option value="">All sources</option>
                <option value="booking">Booking</option>
                <option value="home_service">Home Service</option>
              </select>
            </label>

            {/* Category */}
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Category
              <select
                aria-label="Category"
                className={compactFieldClass}
                value={filters.category}
                onChange={(e) => changeFilter("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Method */}
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Method
              <select
                aria-label="Payment method"
                className={compactFieldClass}
                value={filters.method}
                onChange={(e) => changeFilter("method", e.target.value)}
              >
                <option value="">All methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>

            {/* Status */}
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Status
              <select
                aria-label="Payment status"
                className={compactFieldClass}
                value={filters.status}
                onChange={(e) => changeFilter("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/40 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                <th className="py-2 pl-5 pr-3">Date & Time</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Customer / Source</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2 text-right">Inflow</th>
                <th className="px-3 py-2 text-right">Outflow</th>
                <th className="px-3 py-2 text-right">Net Effect</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="py-2 pl-3 pr-5 text-right">···</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-border-soft)]">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-xs text-[var(--cs-text-muted)]"
                  >
                    No ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const isRefunded = entry.paymentStatus === "refunded";
                  const isPendingPayOnSite =
                    entry.method === "pay_on_site" && entry.paymentStatus !== "paid";
                  const inflow =
                    !isRefunded && !isPendingPayOnSite && entry.amount > 0
                      ? entry.amount
                      : 0;
                  const outflow = isRefunded ? entry.amount : 0;
                  const net = inflow - outflow;
                  const ref =
                    entry.reference ||
                    `${entry.source === "home_service" ? "HS" : "BK"}-${entry.date.replace(/-/g, "")}-${entry.id.replace(/\D/g, "").slice(0, 3) || entry.id.slice(0, 3).toUpperCase()}`;
                  const categoryName =
                    entry.source === "home_service" ? "Home Service" : "Booking";
                  const methodLabel =
                    PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                    entry.method;

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => onSelect(entry)}
                      className="cursor-pointer transition-colors hover:bg-[var(--cs-surface-warm)]/70"
                    >
                      <td className="whitespace-nowrap py-2 pl-5 pr-3 text-xs text-[var(--cs-text-secondary)] font-medium">
                        {entry.date} {formatTime12h(entry.time)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--cs-text-secondary)]">
                        {ref}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-[var(--cs-text)]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(entry);
                          }}
                          className="font-semibold text-[var(--cs-text)] hover:underline text-left outline-none cursor-pointer"
                          aria-label={`View ${entry.customer}, ${entry.service}, ${entry.date}`}
                        >
                          {entry.customer}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cs-text)]">
                          {getCategoryIcon(entry.source)}
                          {categoryName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--cs-text-secondary)]">
                        {methodLabel}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-xs">
                        {isPendingPayOnSite ? (
                          <span className="text-[var(--cs-text-muted)] font-normal">—</span>
                        ) : inflow > 0 ? (
                          <span className="text-emerald-700">{peso(inflow)}</span>
                        ) : (
                          <span className="text-[var(--cs-text-muted)] font-normal">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-xs">
                        {outflow > 0 ? (
                          <div>
                            <span className="text-rose-700">{peso(outflow)}</span>
                            {isRefunded && (
                              <span className="sr-only">Refunded snapshot</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--cs-text-muted)] font-normal">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-xs">
                        {isPendingPayOnSite ? (
                          <span className="text-[var(--cs-text-muted)] font-normal">—</span>
                        ) : isRefunded ? (
                          <span className="text-rose-700">-{peso(entry.amount)}</span>
                        ) : net > 0 ? (
                          <span className="text-[var(--cs-text)]">{peso(net)}</span>
                        ) : net < 0 ? (
                          <span className="text-rose-700">-{peso(Math.abs(net))}</span>
                        ) : (
                          <span className="text-[var(--cs-text-muted)] font-normal">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <CashFlowStatus
                          tone={isPendingPayOnSite ? "warning" : entry.paymentStatus}
                        >
                          {isPendingPayOnSite ? "Pending" : entry.paymentStatus}
                        </CashFlowStatus>
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 pr-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-md hover:bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] outline-none"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Actions for ${entry.customer}, ${entry.service}, ${entry.date}`}
                              >
                                <MoreHorizontal className="size-3.5" />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-44 p-1">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(entry);
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="size-3.5 text-stone-500" />
                              View details
                            </DropdownMenuItem>
                            {onCorrectEntry && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCorrectEntry(entry);
                                }}
                                className="text-xs flex items-center gap-2 cursor-pointer font-medium text-emerald-800"
                              >
                                <RotateCcw className="size-3.5 text-emerald-700" />
                                Correct entry
                              </DropdownMenuItem>
                            )}
                            {onAddRelatedEntry && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddRelatedEntry(entry);
                                }}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                <Plus className="size-3.5 text-stone-500" />
                                Add related entry
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination inside the SAME Ledger card */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] px-5 py-2.5 text-xs text-[var(--cs-text-secondary)]">
          <div>
            Showing{" "}
            <span className="font-semibold text-[var(--cs-text)]">
              {filtered.length > 0 ? startIdx + 1 : 0}–
              {Math.min(startIdx + pageSize, filtered.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[var(--cs-text)]">{filtered.length}</span> records
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="h-7.5 rounded-md border border-[var(--cs-border)] bg-white px-2 text-xs font-semibold text-[var(--cs-text)] shadow-2xs outline-none"
                aria-label="Records per page"
              >
                <option value={12}>12 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--cs-border)] bg-white text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] disabled:opacity-40 shadow-2xs"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = i;
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-label={`Page ${pageNumber + 1}`}
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition shadow-2xs ${
                      isActive
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
                    }`}
                  >
                    {pageNumber + 1}
                  </button>
                );
              })}

              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(currentPage + 1)}
                className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--cs-border)] bg-white text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] disabled:opacity-40 shadow-2xs"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}