"use client";

import React, { KeyboardEvent } from "react";
import type { ReportTab } from "@/lib/owner/reports-types";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Sparkles,
  Users2,
  FileSpreadsheet,
} from "lucide-react";

export interface ReportsTabBarProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
}

interface TabItem {
  id: ReportTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isEvidence?: boolean;
}

const TABS: TabItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "branch", label: "Branch Reports", icon: Building2 },
  { id: "financial", label: "Financial Reports", icon: Receipt },
  { id: "service", label: "Service Reports", icon: Sparkles },
  { id: "staff", label: "Staff Reports", icon: Users2 },
  { id: "sheet", label: "Sheet Evidence", icon: FileSpreadsheet, isEvidence: true },
];

export function ReportsTabBar({ activeTab, onTabChange }: ReportsTabBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = TABS[nextIndex]?.id;
    if (nextTab) {
      onTabChange(nextTab);
      const nextBtn = document.getElementById(`reports-tab-${nextTab}`);
      nextBtn?.focus();
    }
  };

  return (
    <div className="w-full overflow-x-auto border-b border-stone-200 scrollbar-none">
      <nav
        role="tablist"
        aria-label="Reports workspace tabs"
        className="flex min-w-max items-center gap-1.5 py-1"
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`reports-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`reports-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`group relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                isActive
                  ? tab.isEvidence
                    ? "bg-amber-100/80 text-amber-900 shadow-xs ring-1 ring-amber-300/60"
                    : "bg-[#1B4D3E] text-white shadow-sm"
                  : tab.isEvidence
                    ? "text-amber-800 hover:bg-amber-50/70"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isActive
                    ? tab.isEvidence
                      ? "text-amber-700"
                      : "text-emerald-300"
                    : tab.isEvidence
                      ? "text-amber-600"
                      : "text-stone-400 group-hover:text-stone-600"
                }`}
              />
              <span>{tab.label}</span>

              {tab.isEvidence && (
                <span
                  className={`ml-1 rounded px-1.5 py-0.2 text-[10px] uppercase font-bold tracking-wider ${
                    isActive ? "bg-amber-200/90 text-amber-900" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  External
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
