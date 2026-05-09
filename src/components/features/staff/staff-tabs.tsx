"use client";

import type { StaffTab } from "./staff-management-utils";

type StaffTabsProps = {
  activeTab: StaffTab;
  activeCount: number;
  pendingCount: number;
  onTabChange: (tab: StaffTab) => void;
};

export function StaffTabs({ activeTab, activeCount, pendingCount, onTabChange }: StaffTabsProps) {
  const tabs: { value: StaffTab; label: string; count: number }[] = [
    { value: "active", label: "Active Staff", count: activeCount },
    { value: "pending", label: "Pending", count: pendingCount },
  ];

  return (
    <div
      className="inline-flex rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-1 shadow-[var(--cs-shadow-xs)]"
      role="tablist"
      aria-label="Staff status"
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTabChange(tab.value)}
            className={[
              "h-8 rounded-lg px-3 text-sm font-medium transition",
              selected
                ? "bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)] shadow-[inset_0_0_0_1px_rgba(166,123,91,0.18)]"
                : "text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]",
            ].join(" ")}
          >
            {tab.label} <span className="text-xs opacity-75">({tab.count})</span>
          </button>
        );
      })}
    </div>
  );
}
