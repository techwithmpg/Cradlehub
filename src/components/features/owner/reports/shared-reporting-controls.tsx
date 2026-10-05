"use client";

import React, { useState } from "react";
import type { BranchOption } from "@/lib/owner/reports-types";
import { Building2, Calendar, RefreshCw, ChevronDown } from "lucide-react";

export interface SharedReportingControlsProps {
  branchId: string;
  branches: BranchOption[];
  preset: string;
  from: string;
  to: string;
  dateRangeLabel: string;
  isPending?: boolean;
  onScopeChange: (branchId: string) => void;
  onPresetChange: (preset: string) => void;
  onCustomRangeChange: (from: string, to: string) => void;
  onRefresh?: () => void;
}

const PRESETS = [
  { id: "today", label: "Today", ariaLabel: "Today" },
  { id: "last7", label: "7 Days", ariaLabel: "Last 7 Days" },
  { id: "last30", label: "30 Days", ariaLabel: "Last 30 Days" },
  { id: "thisMonth", label: "This Month", ariaLabel: "This Month" },
  { id: "custom", label: "Custom", ariaLabel: "Custom" },
];

export function SharedReportingControls({
  branchId,
  branches,
  preset,
  from,
  to,
  dateRangeLabel,
  isPending = false,
  onScopeChange,
  onPresetChange,
  onCustomRangeChange,
  onRefresh,
}: SharedReportingControlsProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  // Compute descriptive scope subtitle
  const selectedBranch = branches.find((b) => b.id === branchId);
  const branchSubtitle =
    branchId === "all" || !selectedBranch
      ? branches.length > 0
        ? `View combined performance across ${branches.map((b) => b.name).join(" and ")}`
        : "View combined performance across all branches"
      : `Viewing ${selectedBranch.name} reporting data`;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo) {
      onCustomRangeChange(customFrom, customTo);
      setShowCustomModal(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
      {/* LEFT: Reporting Scope Selector & Subtitle */}
      <div className="flex flex-col gap-1 sm:max-w-md">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Reporting Scope
        </label>
        <div className="relative inline-flex items-center">
          <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-stone-500" />
          <select
            value={branchId}
            onChange={(e) => onScopeChange(e.target.value)}
            disabled={isPending}
            className="w-full appearance-none rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-9 text-sm font-semibold text-stone-800 shadow-2xs hover:border-stone-400 focus:border-emerald-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-700 disabled:opacity-60"
            aria-label="Filter report by branch"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-stone-400" />
        </div>
        <p className="text-[11px] text-stone-500 truncate" title={branchSubtitle}>
          {branchSubtitle}
        </p>
      </div>

      {/* RIGHT: Date Range Presets & Resolved Date Display */}
      <div className="flex flex-col gap-2 sm:items-start lg:items-end">
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Date Range
          </label>
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
            <Calendar className="h-3.5 w-3.5 text-stone-500" />
            <span>{dateRangeLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50/80 p-0.5 shadow-2xs">
            {PRESETS.map((p) => {
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={p.ariaLabel ?? p.label}
                  onClick={() => {
                    if (p.id === "custom") {
                      setShowCustomModal(true);
                    } else {
                      onPresetChange(p.id);
                    }
                  }}
                  disabled={isPending}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white text-emerald-900 font-semibold shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Refresh Action */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isPending}
              title="Refresh report data"
              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-1.5 text-stone-600 shadow-2xs hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isPending ? "animate-spin text-emerald-700" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Popover / Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">Custom Date Range</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Select specific start and end dates for reporting
            </p>

            <form onSubmit={handleApplyCustom} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-900 shadow-2xs focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-900 shadow-2xs focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1B4D3E] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#153e32]"
                >
                  Apply Dates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
