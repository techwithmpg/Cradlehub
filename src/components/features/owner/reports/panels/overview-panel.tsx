"use client";

import React from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { formatPeso, formatPesoCompact } from "@/lib/owner/reports";
import { LineChart } from "../charts/line-chart";
import { BarChart } from "../charts/bar-chart";
import { DonutChart } from "../charts/donut-chart";
import {
  TrendingUp,
  CheckCircle2,
  CalendarCheck,
  CreditCard,
  Building2,
  Users2,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";

export interface OverviewPanelProps {
  data: OwnerReportsData;
  onNavigateToTab: (tab: ReportTab) => void;
}

export function OverviewPanel({ data, onNavigateToTab }: OverviewPanelProps) {
  const kpis = data.kpis ?? {
    canonicalRevenue: 0,
    completedServices: 0,
    totalBookings: 0,
    averageBookingValue: 0,
    collectedPayments: 0,
    averageTransaction: 0,
    uniqueCustomers: 0,
    activeStaffCount: 0,
    avgServicesPerStaff: 0,
  };

  const revenueData = data.revenueData ?? [];
  const trendData = data.trendData ?? [];
  const paymentBreakdown = data.paymentBreakdown?.methods ?? [];
  const staffData = data.staffData ?? [];
  const sheetEvidence = data.sheetEvidence;

  // Prepare series for Revenue Trend chart
  // If "all" branches, we can show branch series if available
  const hasBranchSeries =
    revenueData.length > 1 &&
    trendData.some((d) => d.branchSeries && Object.keys(d.branchSeries).length > 0);

  const lineSeries = hasBranchSeries
    ? [
        { key: "revenue", name: "Combined Total", color: "#1B4D3E", strokeWidth: 2.5 },
        ...revenueData.map((b, idx) => ({
          key: `branch_${b.branchId ?? b.name}`,
          name: b.name,
          color: idx === 0 ? "#10B981" : idx === 1 ? "#3B82F6" : "#F59E0B",
          strokeWidth: 1.5,
        })),
      ]
    : [{ key: "revenue", name: "Posted Receipts", color: "#1B4D3E", strokeWidth: 2.5 }];

  // Transform trendData to flatten branchSeries for chart
  const formattedLineData: Array<{
    date: string;
    [key: string]: string | number | undefined;
  }> = trendData.map((t) => {
    const row: { date: string; [key: string]: string | number | undefined } = {
      date: t.date,
      revenue: t.revenue,
    };
    if (t.branchSeries) {
      for (const [bId, val] of Object.entries(t.branchSeries)) {
        row[`branch_${bId}`] = val;
      }
    }
    return row;
  });

  // Prepare Booking Trend bar chart data
  const bookingBarData = trendData.map((t) => {
    const parts = t.date.split("-");
    const label = parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : t.date;
    return {
      label,
      value: t.completedCount,
      secondaryValue: Math.max(0, t.count - t.completedCount),
      subLabel: `${t.completedCount} completed of ${t.count}`,
    };
  });

  // Payment Methods palette
  const paymentColors: Record<string, string> = {
    cash: "#10B981", // Emerald
    gcash: "#007DFE", // GCash Blue
    maya: "#00D632", // Maya Green
    card: "#8B5CF6", // Purple
    bank_transfer: "#F59E0B", // Amber
    pay_on_site: "#6366F1", // Indigo
    other: "#9CA3AF", // Gray
  };

  const paymentDonutData = paymentBreakdown.map((p) => ({
    label: p.label,
    value: p.amount,
    color: paymentColors[p.method] ?? "#64748B",
    subLabel: `${p.count} txn`,
  }));

  // Staff preview list (top 5)
  const topStaff = staffData.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ── 1. Top KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Revenue KPI */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Posted Receipts
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.canonicalRevenue)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Posted financial receipt movements</span>
          </div>
        </div>

        {/* Completed Services */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Completed Services
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.completedServices.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Finished service appointments</div>
        </div>

        {/* Total Bookings */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Total Bookings
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.totalBookings.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Excludes cancelled and no-show</div>
        </div>

        {/* Average Booking Value */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Avg Booking Value
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.averageBookingValue)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Per completed appointment</div>
        </div>
      </div>

      {/* ── 2. Revenue Trend & Branch Performance ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Trend (2 cols) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Posted Receipts Trend</h2>
              <p className="text-xs text-stone-500">
                Daily posted canonical receipts over selected period
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-stone-700">Total: </span>
              <span className="text-sm font-bold text-emerald-800">
                {formatPeso(kpis.canonicalRevenue)}
              </span>
            </div>
          </div>

          <LineChart
            data={formattedLineData}
            series={lineSeries}
            height={260}
            emptyMessage="No revenue activity recorded in this period"
          />
        </div>

        {/* Branch Performance / Drilldown (1 col) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Branch Performance</h2>
              <p className="text-xs text-stone-500">Posted receipt contribution & share</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab("branch")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>Details</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {revenueData.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
              No branch receipt data in this period
            </div>
          ) : (
            <div className="space-y-4">
              {revenueData.map((branch) => {
                const sharePercent =
                  branch.share ??
                  (kpis.canonicalRevenue > 0
                    ? Math.round((branch.revenue / kpis.canonicalRevenue) * 100)
                    : 0);

                return (
                  <div
                    key={branch.name}
                    className="rounded-lg border border-stone-100 bg-stone-50/60 p-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-1.5 text-stone-900">
                        <Building2 className="h-3.5 w-3.5 text-stone-500" />
                        <span>{branch.name}</span>
                      </div>
                      <span className="text-emerald-800">{formatPeso(branch.revenue)}</span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-[#1B4D3E]"
                        style={{ width: `${Math.min(100, Math.max(2, sharePercent))}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                      <span>{branch.count} bookings</span>
                      <span>{sharePercent}% of total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Booking Trend & Payment Methods ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Booking Trend */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Booking Activity Trend</h2>
              <p className="text-xs text-stone-500">Completed vs total bookings across period</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1B4D3E]" />
                <span className="text-stone-600">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D4A373]" />
                <span className="text-stone-600">Other</span>
              </div>
            </div>
          </div>

          <BarChart
            data={bookingBarData}
            height={220}
            color="#1B4D3E"
            secondaryColor="#D4A373"
            valueFormatter={(v) => `${v} bookings`}
            emptyMessage="No booking activity in this period"
          />
        </div>

        {/* Payment Methods */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Payment Methods</h2>
              <p className="text-xs text-stone-500">Canonical collected payment channels</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab("financial")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>Financials</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <DonutChart
            data={paymentDonutData}
            size={180}
            centerLabel="Collected"
            centerValue={formatPesoCompact(kpis.collectedPayments)}
            emptyMessage="No payment method data recorded"
          />
        </div>
      </div>

      {/* ── 4. Staff Preview & Master Sheet Evidence ──────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Staff Preview (2 cols) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Top Staff Activity Preview</h2>
              <p className="text-xs text-stone-500">
                Staff member productivity based on completed services
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab("staff")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>View all staff</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {topStaff.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
              No staff activity recorded in this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2">Staff Member</th>
                    <th className="pb-2">Branch</th>
                    <th className="pb-2 text-right">Completed</th>
                    <th className="pb-2 text-right">Revenue Attribution</th>
                    <th className="pb-2 text-right">Avg / Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {topStaff.map((staff) => (
                    <tr key={staff.staffId} className="hover:bg-stone-50/50">
                      <td className="py-2.5 font-medium text-stone-900">
                        <div className="flex items-center gap-2">
                          <Users2 className="h-3.5 w-3.5 text-stone-400" />
                          <span>{staff.name}</span>
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-500">
                            {staff.tier}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-stone-600">{staff.branchName ?? "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-stone-800">
                        {staff.completed}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-800">Deferred</td>
                      <td className="py-2.5 text-right text-stone-600">Deferred</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Master Sheet Evidence Card (1 col) */}
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/40 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <FileSpreadsheet className="h-4 w-4 text-amber-700" />
                <span>Master Sheet</span>
              </div>
              <span className="rounded-md border border-amber-200 bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                READ-ONLY
              </span>
            </div>

            <p className="text-xs text-amber-900/80 leading-relaxed">
              External operational evidence observed from Stage 1D/1E projection.
            </p>

            {sheetEvidence?.status === "available" && sheetEvidence.coverage !== "NO_COVERAGE" ? (
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                  <span className="text-amber-800">Status</span>
                  <span className="font-semibold text-amber-950 uppercase">
                    {sheetEvidence.status}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                  <span className="text-amber-800">Visits in selected dates</span>
                  <span className="font-semibold text-amber-950">{sheetEvidence.visitCount}</span>
                </div>
                <div className="text-amber-900">
                  Date coverage: {sheetEvidence.coverage.replaceAll("_", " ")} ·{" "}
                  {sheetEvidence.coverageFrom}–{sheetEvidence.coverageTo}
                </div>
                <div className="text-amber-900">
                  {sheetEvidence.mappedBranch} · {sheetEvidence.mappingStatus} source mapping
                </div>
                {sheetEvidence.scopeNote && (
                  <div className="text-amber-900">{sheetEvidence.scopeNote}</div>
                )}
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                  <span className="text-amber-800">Needs Review</span>
                  <span className="font-semibold text-amber-950">
                    {sheetEvidence.needsReviewCount}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                  <span className="text-amber-800">Evidence Amount</span>
                  <span className="font-semibold text-amber-950">
                    {formatPeso(sheetEvidence.evidenceAmount)}
                  </span>
                </div>

                {/* Explicit Guarantee */}
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/90 p-2 text-center text-[11px] font-semibold text-amber-900">
                  Effect on canonical totals: ₱0.00
                </div>
              </div>
            ) : (
              <div className="mt-4 text-center text-xs text-amber-700">
                {sheetEvidence?.coverage === "NO_COVERAGE"
                  ? `No Master Sheet coverage for ${data.from}–${data.to}; loaded ${sheetEvidence.coverageFrom}–${sheetEvidence.coverageTo}.`
                  : (sheetEvidence?.scopeNote ?? "External sheet evidence loading or unavailable")}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/60">
            <button
              type="button"
              onClick={() => onNavigateToTab("sheet")}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200/80 transition-colors"
            >
              <span>Inspect Sheet Evidence</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
