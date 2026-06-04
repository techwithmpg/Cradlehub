"use client";

export type DriverJobsTab = "today" | "all";

type DriverJobsTabsProps = {
  activeTab: DriverJobsTab;
  todayCount: number;
  onTabChange: (tab: DriverJobsTab) => void;
};

const TABS: { key: DriverJobsTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "all", label: "All" },
];

export function DriverJobsTabs({
  activeTab,
  todayCount,
  onTabChange,
}: DriverJobsTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Job filters"
      className="grid grid-cols-2 border-b border-stone-200"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const label = tab.key === "today" ? `Today (${todayCount})` : tab.label;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onTabChange(tab.key)}
            className={[
              "min-h-14 border-b-[5px] px-2 pb-4 pt-3 text-center text-[24px] font-black transition",
              isActive
                ? "border-emerald-800 text-emerald-800"
                : "border-transparent text-stone-500",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
