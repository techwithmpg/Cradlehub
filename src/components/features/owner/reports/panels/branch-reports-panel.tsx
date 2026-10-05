"use client";

import React from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { formatPeso } from "@/lib/owner/reports";
import { LineChart } from "../charts/line-chart";
import { ProgressBarList } from "../charts/progress-bar-list";
import { Building2, Info, ArrowRight } from "lucide-react";

export interface BranchReportsPanelProps {
  data: OwnerReportsData;
  onNavigateToTab: (tab: ReportTab) => void;
}

export function BranchReportsPanel({ data, onNavigateToTab }: BranchReportsPanelProps) {
  const isAllBranches = !data.branchId || data.branchId === "all";
  const revenueData = data.revenueData ?? [];
  const trendData = data.trendData ?? [];
  const serviceData = data.serviceData ?? [];
  const staffData = data.staffData ?? [];
  const kpis = data.kpis ?? {
    canonicalRevenue: 0,
    completedServices: 0,
    totalBookings: 0,
    averageBookingValue: 0,
  };

  // Filter staff by branch if single branch selected
  const branchStaff = isAllBranches
    ? staffData
    : staffData.filter((s) => s.branchId === data.branchId);

  // If single branch, find services completed at this branch
  const branchServices = isAllBranches
    ? serviceData
    : serviceData
        .filter((s) => (s.branchBreakdown?.[data.branchId!] ?? 0) > 0)
        .map((s) => ({
          ...s,
          completedCount: s.branchBreakdown?.[data.branchId!] ?? 0,
        }))
        .sort((a, b) => b.completedCount - a.completedCount);

  // Branch trend chart data
  const branchLineSeries = isAllBranches
    ? revenueData.map((b, idx) => ({
        key: `branch_${b.branchId ?? b.name}`,
        name: b.name,
        color: idx === 0 ? "#10B981" : idx === 1 ? "#3B82F6" : "#F59E0B",
        strokeWidth: 2,
      }))
    : [
        {
          key: "revenue",
          name: data.branchName ?? "Branch Posted Receipts",
          color: "#1B4D3E",
          strokeWidth: 2,
        },
      ];

  const formattedTrendData: Array<{
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

  return (
    <div className="space-y-6">
      {/* ── Header Scope Notice ───────────────────────────────────── */}
      <div className="flex flex-col gap-2 rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-stone-900">
          <Building2 className="h-5 w-5 text-emerald-800" />
          <span className="text-sm font-bold">
            {isAllBranches
              ? "Cross-Branch Comparative Analysis"
              : `${data.branchName} Performance Analysis`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-500">
          <Info className="h-3.5 w-3.5 text-stone-400" />
          <span>
            {isAllBranches
              ? "Comparing performance across all operational branches"
              : `Showing verified canonical data strictly for ${data.branchName}`}
          </span>
        </div>
      </div>

      {/* ── 1. Branch Summary KPI Cards ───────────────────────────── */}
      {isAllBranches ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {revenueData.map((branch, idx) => {
            const share =
              branch.share ??
              (kpis.canonicalRevenue > 0
                ? Math.round((branch.revenue / kpis.canonicalRevenue) * 100)
                : 0);

            return (
              <div
                key={branch.name}
                className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: idx === 0 ? "#10B981" : idx === 1 ? "#3B82F6" : "#F59E0B",
                      }}
                    />
                    <h3 className="text-sm font-bold text-stone-900">{branch.name}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {share}% Share
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500">Posted Receipts</span>
                    <div className="mt-0.5 text-base font-bold text-stone-900">
                      {formatPeso(branch.revenue)}
                    </div>
                  </div>
                  <div>
                    <span className="text-stone-500">Completed Services</span>
                    <div className="mt-0.5 text-base font-bold text-stone-900">
                      {(branch.completedCount ?? branch.count).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-stone-500">Total Bookings</span>
                    <div className="mt-0.5 text-base font-bold text-stone-900">
                      {branch.count.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-stone-500">Avg Booking Value</span>
                    <div className="mt-0.5 text-base font-bold text-stone-900">
                      {formatPeso(branch.avgBookingValue ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Single Branch Scope KPIs */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Branch Posted Receipts
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              {formatPeso(kpis.canonicalRevenue)}
            </div>
            <div className="mt-1 text-[11px] text-stone-500">Posted financial receipts</div>
          </div>
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Completed Services
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              {kpis.completedServices.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-stone-500">At {data.branchName}</div>
          </div>
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Total Appointments
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              {kpis.totalBookings.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-stone-500">Excludes cancelled and no-show</div>
          </div>
          <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Avg Booking Value
            </span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              {formatPeso(kpis.averageBookingValue)}
            </div>
            <div className="mt-1 text-[11px] text-stone-500">Per completed service</div>
          </div>
        </div>
      )}

      {/* ── 2. Time-series Branch Trend ───────────────────────────── */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">
              {isAllBranches
                ? "Cross-Branch Receipts Trajectory"
                : `${data.branchName} Receipts Trajectory`}
            </h2>
            <p className="text-xs text-stone-500">
              {isAllBranches
                ? "Daily posted receipts separated by branch"
                : `Daily posted receipts for ${data.branchName}`}
            </p>
          </div>
        </div>

        <LineChart
          data={formattedTrendData}
          series={branchLineSeries}
          height={260}
          emptyMessage="No branch revenue activity in this period"
        />
      </div>

      {/* ── 3. Branch Top Services & Staff Breakdown ──────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Branch Services */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                {isAllBranches
                  ? "Top Services Across Branches"
                  : `Top Services at ${data.branchName}`}
              </h2>
              <p className="text-xs text-stone-500">Ranked by completed appointments</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab("service")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>Service Reports</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <ProgressBarList
            items={branchServices.slice(0, 5).map((s) => ({
              id: s.serviceId,
              label: s.name,
              subLabel: s.category,
              value: s.completedCount,
              formattedValue: `${s.completedCount} completed`,
              badge: `${s.completedCount} completed`,
              color: "#1B4D3E",
            }))}
            showRanking
            emptyMessage="No service records found for this scope"
          />
        </div>

        {/* Branch Staff */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                {isAllBranches ? "Staff Productivity by Branch" : `Staff at ${data.branchName}`}
              </h2>
              <p className="text-xs text-stone-500">
                Completed services; revenue attribution deferred
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab("staff")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              <span>Staff Reports</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <ProgressBarList
            items={branchStaff.slice(0, 5).map((st) => ({
              id: st.staffId,
              label: st.name,
              subLabel: `${st.branchName ?? "Branch"} • ${st.tier}`,
              value: st.completed,
              formattedValue: `${st.completed} completed`,
              badge: `${st.completed} completed`,
              color: "#2E7D5B",
            }))}
            showRanking
            emptyMessage="No staff records found for this scope"
          />
        </div>
      </div>
    </div>
  );
}
