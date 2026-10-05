"use client";

import React, { useState } from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { formatPeso } from "@/lib/owner/reports";
import { ProgressBarList } from "../charts/progress-bar-list";
import { Users2, Sparkles, TrendingUp, Award, Search, Download } from "lucide-react";

export interface StaffReportsPanelProps {
  data: OwnerReportsData;
  onNavigateToTab?: (tab: ReportTab) => void;
}

export function StaffReportsPanel({ data }: StaffReportsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");

  const kpis = data.kpis ?? {
    activeStaffCount: 0,
    completedServices: 0,
    canonicalRevenue: 0,
    averageServicesPerStaff: 0,
  };

  const staffData = data.staffData ?? [];
  const branches = data.branches ?? [];

  // Filter staff by search, branch, tier
  const filteredStaff = staffData.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.topService && s.topService.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBranch =
      selectedBranch === "all" || s.branchId === selectedBranch || s.branchName === selectedBranch;
    const matchesTier = selectedTier === "all" || s.tier === selectedTier;
    return matchesSearch && matchesBranch && matchesTier;
  });

  const tiers = Array.from(new Set(staffData.map((s) => s.tier)));

  return (
    <div className="space-y-6">
      {/* ── 1. Top KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Staff */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Active Staff
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <Users2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.activeStaffCount.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Therapists with appointments</div>
        </div>

        {/* Total Completed Services */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Total Completed
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.completedServices.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Services fulfilled</div>
        </div>

        {/* Attributed Revenue */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Attributed Revenue
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {formatPeso(kpis.canonicalRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Direct booking attribution</div>
        </div>

        {/* Average per Staff */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Avg per Therapist
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.averageServicesPerStaff ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Services per active staff</div>
        </div>
      </div>

      {/* ── 2. Top Staff Rankings ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Staff by Completed Services */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Top Staff by Services</h2>
            <p className="text-xs text-stone-500">
              Ranked by completed appointments during this period
            </p>
          </div>

          <ProgressBarList
            items={staffData.slice(0, 6).map((s) => ({
              id: s.staffId,
              label: s.name,
              subLabel: `${s.branchName ?? "Branch"} • ${s.tier}${
                s.topService ? ` • Top: ${s.topService}` : ""
              }`,
              value: s.completed,
              formattedValue: `${s.completed} completed`,
              badge: `${s.completionRate}% rate`,
              color: "#1B4D3E",
            }))}
            showRanking
            emptyMessage="No staff activity in this period"
          />
        </div>

        {/* Top Staff by Attributed Revenue */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Revenue Attribution</h2>
            <p className="text-xs text-stone-500">
              Canonical line-price revenue generated by therapist
            </p>
          </div>

          <ProgressBarList
            items={[...staffData]
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 6)
              .map((s) => ({
                id: s.staffId,
                label: s.name,
                subLabel: `Avg ${formatPeso(s.avgPerService)} / service`,
                value: s.revenue,
                formattedValue: formatPeso(s.revenue),
                badge: `${s.completed} svcs`,
                color: "#2E7D5B",
              }))}
            showRanking
            emptyMessage="No staff revenue data available"
          />
        </div>
      </div>

      {/* ── 3. Full Staff Productivity Table ──────────────────────── */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Staff Productivity Details</h2>
            <p className="text-xs text-stone-500">
              Comprehensive operational records and service metrics
            </p>
          </div>

          {/* Controls: Search, Branch, Tier, Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff..."
                className="rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden"
              />
            </div>

            {/* Branch Filter */}
            {branches.length > 0 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="rounded-lg border border-stone-300 py-1.5 pl-2.5 pr-8 text-xs font-medium text-stone-700 focus:border-emerald-700 focus:outline-hidden"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tier Filter */}
            {tiers.length > 0 && (
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="rounded-lg border border-stone-300 py-1.5 pl-2.5 pr-8 text-xs font-medium text-stone-700 focus:border-emerald-700 focus:outline-hidden"
              >
                <option value="all">All Tiers</option>
                {tiers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Truthful Export Action (Disabled) */}
            <button
              type="button"
              disabled
              title="Staff reporting export is disabled pending authorized export pipeline."
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-400 cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5 text-stone-400" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
            No staff records match the current filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2.5">Staff Member</th>
                  <th className="pb-2.5">Branch</th>
                  <th className="pb-2.5">Role / Tier</th>
                  <th className="pb-2.5 text-right">Total Bookings</th>
                  <th className="pb-2.5 text-right">Completed</th>
                  <th className="pb-2.5 text-right">Completion Rate</th>
                  <th className="pb-2.5 text-right">Revenue</th>
                  <th className="pb-2.5 text-right">Avg / Service</th>
                  <th className="pb-2.5">Top Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.staffId} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-2.5 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <Users2 className="h-3.5 w-3.5 text-stone-400" />
                        <span>{staff.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-stone-600">{staff.branchName ?? "—"}</td>
                    <td className="py-2.5">
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {staff.tier}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-stone-700">{staff.total}</td>
                    <td className="py-2.5 text-right font-semibold text-stone-900">
                      {staff.completed}
                    </td>
                    <td className="py-2.5 text-right font-mono text-stone-600">
                      {staff.completionRate}%
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-800">
                      {formatPeso(staff.revenue)}
                    </td>
                    <td className="py-2.5 text-right text-stone-600">
                      {formatPeso(staff.avgPerService)}
                    </td>
                    <td className="py-2.5 text-stone-500 truncate max-w-[140px]">
                      {staff.topService ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
