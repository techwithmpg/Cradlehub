"use client";

import React from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { formatPeso, formatPesoCompact } from "@/lib/owner/reports";
import { LineChart } from "../charts/line-chart";
import { DonutChart } from "../charts/donut-chart";
import { CreditCard, Receipt, Calendar, ArrowRight } from "lucide-react";

export interface FinancialReportsPanelProps {
  data: OwnerReportsData;
  onNavigateToTab: (tab: ReportTab) => void;
}

export function FinancialReportsPanel({ data, onNavigateToTab }: FinancialReportsPanelProps) {
  const kpis = data.kpis ?? {
    canonicalRevenue: 0,
    collectedPayments: 0,
    averageTransaction: 0,
    completedServices: 0,
  };

  const trendData = data.trendData ?? [];
  const paymentBreakdown = data.paymentBreakdown?.methods ?? [];
  const dailyFinancials = data.dailyFinancials ?? [];
  const topPaymentDays = data.topPaymentDays ?? [];
  const sheetEvidence = data.sheetEvidence;

  // Time-series trend for Financials: Recorded Revenue vs Collected Payments
  const lineSeries = [
    { key: "revenue", name: "Posted Receipts", color: "#1B4D3E", strokeWidth: 2.5 },
    { key: "collected", name: "Customer Payments", color: "#10B981", strokeWidth: 2 },
  ];

  const formattedLineData = trendData.map((t) => ({
    date: t.date,
    revenue: t.revenue,
    collected: t.collected,
  }));

  // Payment method colors
  const paymentColors: Record<string, string> = {
    cash: "#10B981",
    gcash: "#007DFE",
    maya: "#00D632",
    card: "#8B5CF6",
    bank_transfer: "#F59E0B",
    pay_on_site: "#6366F1",
    other: "#9CA3AF",
  };

  const paymentDonutData = paymentBreakdown.map((p) => ({
    label: p.label,
    value: p.amount,
    color: paymentColors[p.method] ?? "#64748B",
    subLabel: `${p.count} transactions`,
  }));

  return (
    <div className="space-y-6">
      {/* ── 1. Top Financial KPI Row ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Recorded Revenue (Canonical) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Posted Receipts
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              CANONICAL
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.canonicalRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Positive posted receipt movements</div>
        </div>

        {/* Master Sheet Evidence (External) */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              MASTER SHEET Evidence
            </span>
            <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              READ-ONLY
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-950">
            {sheetEvidence?.status === "available" && sheetEvidence.coverage !== "NO_COVERAGE"
              ? formatPeso(sheetEvidence.evidenceAmount)
              : "Unavailable"}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800/80">
            <span>
              External evidence · date coverage{" "}
              {sheetEvidence?.coverage?.replaceAll("_", " ") ?? "loading"} ·{" "}
              {sheetEvidence?.mappedBranch ?? "source pending"}
            </span>
            <span className="font-semibold text-amber-900">Effect on total: ₱0</span>
          </div>
          {sheetEvidence?.scopeNote && (
            <div className="mt-1 text-[11px] text-amber-900">{sheetEvidence.scopeNote}</div>
          )}
          <button
            type="button"
            onClick={() => onNavigateToTab("sheet")}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:underline cursor-pointer"
          >
            Inspect evidence <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Total Collected Payments */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Collected Payments
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.collectedPayments)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            Posted customer payments and deposits
          </div>
        </div>

        {/* Average Transaction */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Avg Transaction
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.averageTransaction)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Per posted receipt transaction</div>
        </div>
      </div>

      {/* ── 2. Financial Trajectory & Payment Methods ─────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trajectory (2 cols) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Posted Receipts & Customer Payments
              </h2>
              <p className="text-xs text-stone-500">
                Canonical posted receipts compared with the customer payment subset
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1B4D3E]" />
                <span className="text-stone-700">Recorded</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                <span className="text-stone-700">Collected</span>
              </div>
            </div>
          </div>

          <LineChart
            data={formattedLineData}
            series={lineSeries}
            height={260}
            emptyMessage="No financial trajectory data available"
          />
        </div>

        {/* Payment Methods Breakdown (1 col) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Payment Breakdown</h2>
            <p className="text-xs text-stone-500">Distribution across payment channels</p>
          </div>

          <DonutChart
            data={paymentDonutData}
            size={170}
            centerLabel="Collected"
            centerValue={formatPesoCompact(kpis.collectedPayments)}
            emptyMessage="No payment method breakdown"
          />
        </div>
      </div>

      {/* ── 3. Daily Financial Summary Table ───────────────────────── */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Daily Financial Ledger</h2>
            <p className="text-xs text-stone-500">
              Daily posted receipt movements and transaction activity
            </p>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {dailyFinancials.length} days recorded
          </span>
        </div>

        {dailyFinancials.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
            No daily financial records in this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5 text-right">Posted Receipts</th>
                  <th className="pb-2.5 text-right">Collected Payments</th>
                  <th className="pb-2.5 text-right">Transactions</th>
                  <th className="pb-2.5 text-right">Completed Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {dailyFinancials.map((row) => (
                  <tr key={row.date} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-2.5 font-medium text-stone-900 font-sans">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-stone-400" />
                        <span>{row.date}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-800">
                      {formatPeso(row.recordedRevenue)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-stone-800">
                      {formatPeso(row.collectedPayments)}
                    </td>
                    <td className="py-2.5 text-right text-stone-600 font-sans">
                      {row.transactions}
                    </td>
                    <td className="py-2.5 text-right text-stone-600 font-sans">
                      {row.completedBookings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. Top Payment Days Ranking ───────────────────────────── */}
      {topPaymentDays.length > 0 && (
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Top Performing Days</h2>
            <p className="text-xs text-stone-500">Days with highest posted canonical receipts</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topPaymentDays.map((day, idx) => (
              <div
                key={day.date}
                className="rounded-lg border border-stone-200/80 bg-stone-50/50 p-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
                  <span>#{idx + 1}</span>
                  <span className="font-mono text-stone-700">{day.date}</span>
                </div>
                <div className="mt-2 text-base font-bold text-emerald-800">
                  {formatPeso(day.revenue)}
                </div>
                <div className="mt-1 text-[11px] text-stone-500">
                  {day.transactions} txns • {formatPesoCompact(day.collected)} collected
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
