"use client";

import React, { useState } from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { ProgressBarList } from "../charts/progress-bar-list";
import { DonutChart } from "../charts/donut-chart";
import { Sparkles, TrendingUp, Users2, Receipt, Search } from "lucide-react";

export interface ServiceReportsPanelProps {
  data: OwnerReportsData;
  onNavigateToTab?: (tab: ReportTab) => void;
}

export function ServiceReportsPanel({ data }: ServiceReportsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const kpis = data.kpis ?? {
    completedServices: 0,
    canonicalRevenue: 0,
    uniqueCustomers: 0,
    averageBookingValue: 0,
  };

  const serviceData = data.serviceData ?? [];
  const categoryMix = data.categoryMix ?? [];

  // Filter services by search and category
  const filteredServices = serviceData.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Unique categories for filter
  const categories = Array.from(new Set(serviceData.map((s) => s.category)));

  // Category palette
  const categoryColors = [
    "#1B4D3E",
    "#10B981",
    "#D4A373",
    "#3B82F6",
    "#8B5CF6",
    "#F59E0B",
    "#EC4899",
  ];

  const categoryDonutData = categoryMix.map((c, idx) => ({
    label: c.category,
    value: c.count,
    color: categoryColors[idx % categoryColors.length] ?? "#64748B",
    subLabel: `${c.count} completed`,
  }));

  return (
    <div className="space-y-6">
      {/* ── 1. Top KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Services */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Total Services
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.completedServices.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Completed treatments</div>
        </div>

        {/* Service Revenue */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Service Revenue Attribution
            </span>
            <div className="rounded-md bg-emerald-50 p-1.5 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Deferred</div>
          <div className="mt-1 text-[11px] text-stone-500">Requires approved order allocation</div>
        </div>

        {/* Unique Customers */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Unique Customers
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <Users2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {kpis.uniqueCustomers.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Distinct clients served</div>
        </div>

        {/* Average Service Value */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Avg Service Value
            </span>
            <div className="rounded-md bg-stone-100 p-1.5 text-stone-700">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Deferred</div>
          <div className="mt-1 text-[11px] text-stone-500">No safe line allocation yet</div>
        </div>
      </div>

      {/* ── 2. Service Popularity & Category Mix ───────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Popularity Ranking (2 cols) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Service Popularity</h2>
            <p className="text-xs text-stone-500">
              Top performed treatments ranked by completed appointment volume
            </p>
          </div>

          <ProgressBarList
            items={serviceData.slice(0, 7).map((s) => ({
              id: s.serviceId,
              label: s.name,
              subLabel: s.category,
              value: s.completedCount,
              formattedValue: `${s.completedCount} completed`,
              badge: `${s.completedCount} services`,
              color: "#1B4D3E",
            }))}
            showRanking
            emptyMessage="No service data available in this period"
          />
        </div>

        {/* Category Mix Donut (1 col) */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900">Category Mix</h2>
            <p className="text-xs text-stone-500">Distribution across treatment categories</p>
          </div>

          <DonutChart
            data={categoryDonutData}
            size={170}
            centerLabel="Services"
            centerValue={`${kpis.completedServices}`}
            valueFormatter={(v) => `${v} svcs`}
            emptyMessage="No category breakdown available"
          />
        </div>
      </div>

      {/* ── 3. Full Service Details Table ─────────────────────────── */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Service Catalog Performance</h2>
            <p className="text-xs text-stone-500">
              Detailed performance metrics across all treatments
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search service..."
                className="rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-stone-300 py-1.5 pl-2.5 pr-8 text-xs font-medium text-stone-700 focus:border-emerald-700 focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filteredServices.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
            No services match the active filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2.5">Service Name</th>
                  <th className="pb-2.5">Category</th>
                  <th className="pb-2.5 text-right">Completed</th>
                  <th className="pb-2.5 text-right">Revenue Attribution</th>
                  <th className="pb-2.5 text-right">Avg Value</th>
                  <th className="pb-2.5 text-right">Volume Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredServices.map((svc) => (
                  <tr key={svc.serviceId} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-2.5 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-800" />
                        <span>{svc.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {svc.category}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-stone-900">
                      {svc.completedCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-800">Deferred</td>
                    <td className="py-2.5 text-right text-stone-600">Deferred</td>
                    <td className="py-2.5 text-right font-mono text-stone-600">{svc.share}%</td>
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
