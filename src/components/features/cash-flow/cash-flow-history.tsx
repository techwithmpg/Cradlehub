"use client";

import { useId, useMemo, useState } from "react";
import {
  Calendar,
  TrendingDown,
  SlidersHorizontal,
  FileText,
  Check,
  RotateCcw,
  Download,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  validateCashFlowRange,
  type CashFlowDay,
  type CashFlowEntry,
  type CashFlowRange,
} from "@/lib/cash-flow/read-model";
import { Button } from "@/components/ui/button";
import {
  CashFlowMetric,
  CashFlowStatus,
  PAYMENT_METHOD_ICONS,
  fieldClass,
  peso,
} from "./cash-flow-ui";

export interface CashFlowHistoryProps {
  days: CashFlowDay[];
  range: CashFlowRange;
  onRangeChange?: (range: CashFlowRange) => void;
  onSelect: (date: string) => void;
  onCorrectEntry?: (entry: CashFlowEntry) => void;
}

export function exportDailyHistoryToCsv(
  days: CashFlowDay[],
  filename = "cash-flow-history.csv"
) {
  const headers = [
    "Date",
    "Bookings",
    "Income",
    "Expenses",
    "Tips",
    "Staff Advances",
    "Payroll",
    "Other",
    "Net Flow",
    "Status",
  ];

  const rows = days.map((day) => {
    const income = day.summary.total_collected;
    const expenses = day.entries
      .filter((e) => e.paymentStatus === "refunded")
      .reduce((sum, e) => sum + e.amount, 0);
    const net = income - expenses;
    const isReviewed =
      day.reconciliation?.status === "approved" ||
      day.reconciliation?.status === "submitted";

    return [
      day.date,
      day.entries.length,
      income.toFixed(2),
      expenses.toFixed(2),
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      net.toFixed(2),
      isReviewed ? "Reviewed" : "Pending",
    ];
  });

  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join(
      "\n"
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatRangeDate(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDayWithWeekday(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${ymd} ${weekday}`;
}

const METHOD_DISPLAY_NAMES: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  pay_on_site: "Pay on Site",
  other: "Other",
};

export function CashFlowHistory({
  days,
  range,
  onRangeChange,
  onSelect,
  onCorrectEntry,
}: CashFlowHistoryProps) {
  const fromInputId = useId();
  const throughInputId = useId();

  // Local filter states
  const [filterFrom, setFilterFrom] = useState(range.from);
  const [filterTo, setFilterTo] = useState(range.to);
  const [groupBy, setGroupBy] = useState("daily");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [distributionFilter, setDistributionFilter] = useState("inflow");
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);

  // 1. Calculate Top KPI Cards
  const totalInflow = useMemo(() => {
    return days.reduce((sum, d) => sum + d.summary.total_collected, 0);
  }, [days]);

  const totalOutflow = useMemo(() => {
    return days.reduce(
      (sum, d) =>
        sum +
        d.entries
          .filter((e) => e.paymentStatus === "refunded")
          .reduce((eSum, e) => eSum + e.amount, 0),
      0
    );
  }, [days]);

  const netFlow = totalInflow - totalOutflow;

  const totalDays = useMemo(() => {
    if (!range.from || !range.to) return days.length;
    const fromTime = new Date(`${range.from}T00:00:00Z`).getTime();
    const toTime = new Date(`${range.to}T00:00:00Z`).getTime();
    const diff = Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [range.from, range.to, days.length]);

  // 2. Payment Method Distribution
  const methodTotals = useMemo(() => {
    const totals: Record<string, number> = {
      cash: 0,
      gcash: 0,
      maya: 0,
      card: 0,
      pay_on_site: 0,
      other: 0,
    };
    for (const day of days) {
      for (const [m, amt] of Object.entries(day.summary.by_method)) {
        if (totals[m] !== undefined) {
          totals[m] = (totals[m] ?? 0) + amt;
        } else {
          totals.other = (totals.other ?? 0) + amt;
        }
      }
    }
    return totals;
  }, [days]);

  // 3. Chronological Daily Data for the Chart
  const chartDays = useMemo(() => {
    return [...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => {
        const inflow = day.summary.total_collected;
        const outflow = day.entries
          .filter((e) => e.paymentStatus === "refunded")
          .reduce((sum, e) => sum + e.amount, 0);
        const net = inflow - outflow;
        return {
          date: day.date,
          label: formatRangeDate(day.date).slice(0, 6), // e.g. "Sep 01"
          inflow,
          outflow,
          net,
        };
      });
  }, [days]);

  // Chart bounds & geometry
  const chartGeometry = useMemo(() => {
    const maxVal = Math.max(
      ...chartDays.map((d) => Math.max(d.inflow, d.outflow, Math.abs(d.net))),
      1000
    );
    // Round up to clean step
    const step = maxVal > 20000 ? 10000 : maxVal > 5000 ? 5000 : 1000;
    const yMax = Math.ceil(maxVal / step) * step;
    const hasOutflow = chartDays.some((d) => d.outflow > 0 || d.net < 0);
    const yMin = hasOutflow ? -Math.ceil((maxVal * 0.3) / step) * step : 0;
    const yRange = yMax - yMin || 1;

    const width = 640;
    const height = 220;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 30;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const getY = (val: number) => {
      const normalized = (val - yMin) / yRange;
      return paddingTop + (1 - normalized) * plotHeight;
    };

    const zeroY = getY(0);

    const ticks = [];
    const tickCount = 4;
    const tickStep = (yMax - yMin) / tickCount;
    for (let i = 0; i <= tickCount; i++) {
      const val = yMin + i * tickStep;
      ticks.push({ val: Math.round(val), y: getY(val) });
    }

    const n = chartDays.length;
    const colWidth = n > 0 ? plotWidth / n : plotWidth;

    const dayPoints = chartDays.map((d, i) => {
      const x = paddingLeft + (i + 0.5) * colWidth;
      const inflowY = getY(d.inflow);
      const outflowY = getY(-d.outflow);
      const netY = getY(d.net);
      return {
        ...d,
        x,
        inflowY,
        outflowY,
        netY,
        inflowHeight: Math.max(0, zeroY - inflowY),
        outflowHeight: Math.max(0, outflowY - zeroY),
      };
    });

    const netLinePath =
      dayPoints.length > 0
        ? dayPoints
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.netY.toFixed(1)}`)
            .join(" ")
        : "";

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      zeroY,
      ticks,
      dayPoints,
      netLinePath,
      colWidth,
    };
  }, [chartDays]);

  // 4. Apply Filters to Daily History Table
  const filteredDays = useMemo(() => {
    return days.filter((day) => {
      // Status filter
      if (status === "reviewed") {
        const isRev =
          day.reconciliation?.status === "approved" ||
          day.reconciliation?.status === "submitted";
        if (!isRev) return false;
      } else if (status === "pending") {
        const isRev =
          day.reconciliation?.status === "approved" ||
          day.reconciliation?.status === "submitted";
        if (isRev) return false;
      }

      // Method filter
      if (method !== "all") {
        const methodAmt =
          (day.summary.by_method as Record<string, number>)[method] ?? 0;
        if (methodAmt <= 0) return false;
      }

      // Category filter
      if (category !== "all") {
        if (category === "booking" && day.entries.every((e) => e.source !== "booking"))
          return false;
        if (
          category === "home_service" &&
          day.entries.every((e) => e.source !== "home_service")
        )
          return false;
        if (
          category === "refund" &&
          day.entries.every((e) => e.paymentStatus !== "refunded")
        )
          return false;
        if (
          [
            "expense",
            "tip",
            "staff_advance",
            "payroll",
            "petty_cash",
            "transfer",
            "misc_income",
          ].includes(category)
        ) {
          // If category is not present in day, filter out
          return false;
        }
      }

      return true;
    });
  }, [days, status, method, category]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredDays.length / pageSize));
  const paginatedDays = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDays.slice(start, start + pageSize);
  }, [filteredDays, currentPage, pageSize]);

  const [rangeError, setRangeError] = useState<string | null>(null);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      validateCashFlowRange({ from: filterFrom, to: filterTo });
      setRangeError(null);
      if (onRangeChange && (filterFrom !== range.from || filterTo !== range.to)) {
        onRangeChange({ from: filterFrom, to: filterTo });
      }
      setCurrentPage(1);
    } catch {
      setRangeError("Choose a valid date range of up to 31 days.");
    }
  };

  const handleClear = () => {
    setRangeError(null);
    setFilterFrom(range.from);
    setFilterTo(range.to);
    setGroupBy("daily");
    setCategory("all");
    setMethod("all");
    setStatus("all");
    setCurrentPage(1);
    if (onRangeChange && (filterFrom !== range.from || filterTo !== range.to)) {
      onRangeChange(range);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CashFlowMetric
          label="Total Inflow (Range)"
          value={peso(totalInflow)}
          icon={<Calendar className="size-4 text-emerald-700" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-100"
          dotTone="green"
          detail="Total money received"
        />

        <CashFlowMetric
          label="Total Outflow (Range)"
          value={peso(totalOutflow)}
          icon={<TrendingDown className="size-4 text-rose-700" />}
          iconBg="bg-rose-50 text-rose-700 border-rose-100"
          dotTone="coral"
          detail="Total money paid out"
        />

        <CashFlowMetric
          label="Net Flow (Range)"
          value={peso(netFlow)}
          icon={<SlidersHorizontal className="size-4 text-emerald-700" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-100"
          dotTone="green"
          detail="Inflow minus outflow"
        />

        <CashFlowMetric
          label="Days in Period"
          value={String(totalDays)}
          icon={<FileText className="size-4 text-amber-700" />}
          iconBg="bg-amber-50 text-amber-700 border-amber-100"
          dotTone="sand"
          detail={
            <div className="text-[11px] leading-relaxed text-[var(--cs-text-muted)]">
              <div>From {formatRangeDate(range.from)}</div>
              <div>To {formatRangeDate(range.to)}</div>
            </div>
          }
        />
      </div>

      {/* 2. Middle Section: Daily Net Flow Chart + Payment Method Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Card: Daily Net Flow Chart (2 columns) */}
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--cs-text)]">Daily Net Flow</h2>
              <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
                Daily inflow, outflow, and net flow for the selected period.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                aria-label="Chart grouping"
                className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none shadow-xs"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="mt-4 flex items-center justify-end gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-[var(--cs-text-secondary)]">
              <span className="size-2.5 rounded-sm bg-emerald-600" />
              Inflow
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--cs-text-secondary)]">
              <span className="size-2.5 rounded-sm bg-rose-500" />
              Outflow
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--cs-text-secondary)]">
              <span className="h-0.5 w-3 bg-[#C4966E]" />
              Net Flow
            </span>
          </div>

          {/* SVG Chart */}
          <div className="relative mt-2 overflow-x-auto">
            {chartDays.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-xs text-[var(--cs-text-muted)]">
                No financial activity recorded in this period.
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                className="h-56 w-full min-w-[500px]"
                onMouseLeave={() => setHoveredDay(null)}
              >
                {/* Y-Axis Grid Lines & Labels */}
                {chartGeometry.ticks.map((tick) => (
                  <g key={tick.val}>
                    <line
                      x1={chartGeometry.paddingLeft}
                      y1={tick.y}
                      x2={chartGeometry.width - chartGeometry.paddingRight}
                      y2={tick.y}
                      stroke="var(--cs-border-soft)"
                      strokeDasharray={tick.val === 0 ? undefined : "3 3"}
                      strokeWidth={tick.val === 0 ? 1.5 : 1}
                    />
                    <text
                      x={chartGeometry.paddingLeft - 8}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      fontSize="9"
                      fill="var(--cs-text-muted)"
                      fontFamily="monospace"
                    >
                      {peso(tick.val)}
                    </text>
                  </g>
                ))}

                {/* Bars for Each Day */}
                {chartGeometry.dayPoints.map((p) => {
                  const barWidth = Math.min(8, Math.max(3, chartGeometry.colWidth * 0.4));
                  return (
                    <g
                      key={p.date}
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredDay({
                          date: p.date,
                          inflow: p.inflow,
                          outflow: p.outflow,
                          net: p.net,
                        })
                      }
                    >
                      {/* Inflow Bar */}
                      {p.inflowHeight > 0 && (
                        <rect
                          x={p.x - barWidth / 2}
                          y={p.inflowY}
                          width={barWidth}
                          height={p.inflowHeight}
                          fill="#10b981"
                          rx="1.5"
                        />
                      )}

                      {/* Outflow Bar */}
                      {p.outflowHeight > 0 && (
                        <rect
                          x={p.x - barWidth / 2}
                          y={chartGeometry.zeroY}
                          width={barWidth}
                          height={p.outflowHeight}
                          fill="#ef4444"
                          rx="1.5"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Net Flow Line */}
                {chartGeometry.netLinePath && (
                  <path
                    d={chartGeometry.netLinePath}
                    fill="none"
                    stroke="#C4966E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Net Flow Points */}
                {chartGeometry.dayPoints.map((p) => (
                  <circle
                    key={`point-${p.date}`}
                    cx={p.x}
                    cy={p.netY}
                    r={hoveredDay?.date === p.date ? 4.5 : 2.5}
                    fill="#C4966E"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ))}

                {/* X-Axis Date Labels */}
                {chartGeometry.dayPoints
                  .filter((_, idx, arr) => {
                    const step = Math.max(1, Math.floor(arr.length / 8));
                    return idx % step === 0 || idx === arr.length - 1;
                  })
                  .map((p) => (
                    <text
                      key={`label-${p.date}`}
                      x={p.x}
                      y={chartGeometry.height - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--cs-text-muted)"
                    >
                      {p.label}
                    </text>
                  ))}
              </svg>
            )}

            {/* Hover Tooltip */}
            {hoveredDay && (
              <div className="pointer-events-none absolute right-4 top-2 rounded-lg border border-[var(--cs-border)] bg-white p-2 text-xs shadow-md">
                <p className="font-bold text-[var(--cs-text)]">{hoveredDay.date}</p>
                <div className="mt-1 space-y-0.5 text-[11px]">
                  <p className="text-emerald-700">Inflow: {peso(hoveredDay.inflow)}</p>
                  <p className="text-rose-700">Outflow: {peso(hoveredDay.outflow)}</p>
                  <p className="font-semibold text-[var(--cs-text)]">
                    Net: {peso(hoveredDay.net)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Payment Method Distribution (1 column) */}
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[var(--cs-border-soft)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--cs-text)]">
                Payment method distribution
              </h2>
              <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
                Total inflow by payment method for the selected period.
              </p>
            </div>
            <select
              value={distributionFilter}
              onChange={(e) => setDistributionFilter(e.target.value)}
              aria-label="Distribution mode"
              className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none shadow-xs"
            >
              <option value="inflow">Inflow</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="mt-4 space-y-3.5">
            {Object.entries(methodTotals).map(([m, amt]) => {
              const pct = totalInflow > 0 ? Math.round((amt / totalInflow) * 100) : 0;
              return (
                <div key={m} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-[var(--cs-text)]">
                      {PAYMENT_METHOD_ICONS[m] ?? PAYMENT_METHOD_ICONS.other}
                      {METHOD_DISPLAY_NAMES[m] ?? m}
                    </span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-semibold text-[var(--cs-text)]">
                        {peso(amt)}
                      </span>
                      <span className="w-9 text-right text-[var(--cs-text-muted)]">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cs-surface-warm)]">
                    <div
                      className="h-full rounded-full bg-[#1b4332] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Total Inflow Summary Row */}
            <div className="border-t border-[var(--cs-border-soft)] pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--cs-text)]">Total Inflow</span>
                <div className="flex items-center gap-3 tabular-nums font-bold">
                  <span className="text-[var(--cs-text)]">{peso(totalInflow)}</span>
                  <span className="w-9 text-right text-[var(--cs-text)]">100%</span>
                </div>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--cs-surface-warm)]">
                <div className="h-full w-full rounded-full bg-[#1b4332]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Row */}
      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        {/* Date Range */}
        <div className="flex min-w-[260px] flex-1 flex-col gap-1 sm:flex-none">
          <span className="text-xs font-bold text-[var(--cs-text-secondary)]">
            Date range
          </span>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs shadow-xs focus-within:border-[var(--cs-sand)] focus-within:ring-2 focus-within:ring-[var(--cs-sand)]/15">
            <Calendar className="size-3.5 shrink-0 text-[var(--cs-text-muted)]" />
            <label htmlFor={fromInputId} className="sr-only">
              From
            </label>
            <input
              id={fromInputId}
              aria-label="From"
              type="date"
              required
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-28 border-0 bg-transparent p-0 text-xs font-medium text-[var(--cs-text)] outline-none"
            />
            <span className="text-[var(--cs-text-muted)]">→</span>
            <label htmlFor={throughInputId} className="sr-only">
              Through
            </label>
            <input
              id={throughInputId}
              aria-label="Through"
              type="date"
              required
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-28 border-0 bg-transparent p-0 text-xs font-medium text-[var(--cs-text)] outline-none"
            />
          </div>
        </div>

        {/* Group by */}
        <div className="flex min-w-[110px] flex-col gap-1">
          <label
            htmlFor="history-group-by"
            className="text-xs font-bold text-[var(--cs-text-secondary)]"
          >
            Group by
          </label>
          <select
            id="history-group-by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className={fieldClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Category */}
        <div className="flex min-w-[130px] flex-col gap-1">
          <label
            htmlFor="history-category"
            className="text-xs font-bold text-[var(--cs-text-secondary)]"
          >
            Category
          </label>
          <select
            id="history-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
          >
            <option value="all">All categories</option>
            <option value="booking">Booking</option>
            <option value="home_service">Home Service</option>
            <option value="payment">Payment</option>
            <option value="expense">Expense</option>
            <option value="tip">Tip</option>
            <option value="staff_advance">Staff Advance</option>
            <option value="payroll">Payroll</option>
            <option value="commission">Commission Payout</option>
            <option value="petty_cash">Petty Cash</option>
            <option value="transfer">Transfer</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
            <option value="misc_income">Misc Income</option>
          </select>
        </div>

        {/* Method */}
        <div className="flex min-w-[120px] flex-col gap-1">
          <label
            htmlFor="history-method"
            className="text-xs font-bold text-[var(--cs-text-secondary)]"
          >
            Method
          </label>
          <select
            id="history-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={fieldClass}
          >
            <option value="all">All methods</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="card">Card</option>
            <option value="pay_on_site">Pay on Site</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex min-w-[120px] flex-col gap-1">
          <label
            htmlFor="history-status"
            className="text-xs font-bold text-[var(--cs-text-secondary)]"
          >
            Status
          </label>
          <select
            id="history-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={fieldClass}
          >
            <option value="all">All statuses</option>
            <option value="reviewed">Reviewed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            aria-label="Apply"
            className="h-9 rounded-lg bg-[#1b4332] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#16382a]"
          >
            <Check className="mr-1.5 size-3.5" />
            Apply
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-3.5 text-xs font-semibold text-[var(--cs-text)] shadow-xs"
          >
            <RotateCcw className="mr-1.5 size-3.5 text-[var(--cs-text-muted)]" />
            Clear
          </Button>
        </div>
      </form>

      {rangeError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {rangeError}
        </div>
      )}

      {/* 4. Daily History Table Card */}
      <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--cs-text)]">Daily history</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
              Daily financial summary with key metrics and reconciliation status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDailyHistoryToCsv(filteredDays)}
              className="h-8 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] shadow-xs"
            >
              <Download className="mr-1.5 size-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="More options"
              className="size-8 rounded-lg border-[var(--cs-border)] bg-white p-0 text-[var(--cs-text-muted)] shadow-xs"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/40 text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                <th className="py-3 pl-5 pr-3">Date</th>
                <th className="px-3 py-3 text-center">Bookings</th>
                <th className="px-3 py-3 text-right">Income</th>
                <th className="px-3 py-3 text-right">Expenses</th>
                <th className="px-3 py-3 text-right">Tips</th>
                <th className="px-3 py-3 text-right">Staff Advances</th>
                <th className="px-3 py-3 text-right">Payroll</th>
                <th className="px-3 py-3 text-right">Other</th>
                <th className="px-3 py-3 text-right">Net Flow</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-border-soft)]">
              {paginatedDays.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-12 text-center text-xs text-[var(--cs-text-muted)]"
                  >
                    No daily records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedDays.map((day) => {
                  const income = day.summary.total_collected;
                  const expenses = day.entries
                    .filter((e) => e.paymentStatus === "refunded")
                    .reduce((sum, e) => sum + e.amount, 0);
                  const net = income - expenses;
                  const isReviewed =
                    day.reconciliation?.status === "approved" ||
                    day.reconciliation?.status === "submitted";

                  return (
                    <tr
                      key={day.date}
                      onClick={() => onSelect(day.date)}
                      className="cursor-pointer transition-colors hover:bg-[var(--cs-surface-warm)]/70"
                    >
                      <td className="whitespace-nowrap py-3.5 pl-5 pr-3 font-semibold text-[var(--cs-text)]">
                        {formatDayWithWeekday(day.date)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center font-medium text-[var(--cs-text)]">
                        {day.entries.length}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold tabular-nums text-emerald-800">
                        {peso(income)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold tabular-nums text-rose-700">
                        {expenses > 0 ? peso(expenses) : "₱0.00"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-[var(--cs-text-secondary)]">
                        ₱0.00
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-[var(--cs-text-secondary)]">
                        ₱0.00
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-[var(--cs-text-secondary)]">
                        ₱0.00
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-[var(--cs-text-secondary)]">
                        ₱0.00
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-3.5 text-right font-bold tabular-nums ${
                          net > 0
                            ? "text-emerald-800"
                            : net < 0
                              ? "text-rose-700"
                              : "text-[var(--cs-text)]"
                        }`}
                      >
                        {peso(net)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-center">
                        <CashFlowStatus tone={isReviewed ? "success" : "warning"}>
                          {isReviewed ? "Reviewed" : "Pending"}
                        </CashFlowStatus>
                      </td>

                      <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label={`View day ${day.date}`}
                            onClick={() => onSelect(day.date)}
                            className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  aria-label={`More actions for day ${day.date}`}
                                  className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] outline-none"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48 p-1">
                              <DropdownMenuItem
                                onClick={() => onSelect(day.date)}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="size-3.5 text-stone-500" />
                                Open day details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => exportDailyHistoryToCsv([day], `cash-flow-${day.date}.csv`)}
                                className="text-xs flex items-center gap-2 cursor-pointer"
                              >
                                <Download className="size-3.5 text-stone-500" />
                                Download summary
                              </DropdownMenuItem>
                              {onCorrectEntry && day.entries[0] && (
                                <DropdownMenuItem
                                  onClick={() => onCorrectEntry(day.entries[0]!)}
                                  className="text-xs flex items-center gap-2 cursor-pointer font-medium text-emerald-800"
                                >
                                  <RotateCcw className="size-3.5 text-emerald-700" />
                                  Correct entry
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Integrated Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] px-5 py-3 text-xs text-[var(--cs-text-secondary)]">
          <p>
            Showing {filteredDays.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filteredDays.length)} of {filteredDays.length}{" "}
            records
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Records per page"
                className="h-7 rounded-md border border-[var(--cs-border)] bg-white px-2 text-xs font-semibold text-[var(--cs-text)] shadow-2xs outline-none"
              >
                <option value={7}>7 per page</option>
                <option value={10}>10 per page</option>
                <option value={15}>15 per page</option>
                <option value={30}>30 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--cs-border)] bg-white text-[var(--cs-text-muted)] hover:text-[var(--cs-text)] disabled:opacity-40 shadow-2xs"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  aria-label={`Page ${pg}`}
                  onClick={() => setCurrentPage(pg)}
                  className={`inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition shadow-2xs ${
                    pg === currentPage
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                      : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
                  }`}
                >
                  {pg}
                </button>
              ))}

              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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