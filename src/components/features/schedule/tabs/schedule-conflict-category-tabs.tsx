import type {
  ScheduleConflictTabCounts,
  ScheduleConflictTabKey,
} from "./schedule-conflict-center-model";
import { SCHEDULE_CONFLICT_TABS } from "./schedule-conflict-center-model";

type Props = {
  activeTab: ScheduleConflictTabKey;
  counts: ScheduleConflictTabCounts;
  onTabChange: (tab: ScheduleConflictTabKey) => void;
};

export function ScheduleConflictCategoryTabs({
  activeTab,
  counts,
  onTabChange,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label="Schedule conflict center filters"
      className="flex gap-1 overflow-x-auto pb-1"
    >
      {SCHEDULE_CONFLICT_TABS.map((tab) => {
        const active = tab.key === activeTab;
        const count = counts[tab.key];

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${tab.label} ${count}`}
            onClick={() => onTabChange(tab.key)}
            className={
              active
                ? "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-emerald-800 px-3 text-[11px] font-bold text-white shadow-sm"
                : "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--cs-border-soft)] bg-white px-3 text-[11px] font-semibold text-[var(--cs-text-secondary)] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
            }
          >
            <span>{tab.label}</span>
            {count > 0 || tab.key === "all" ? (
              <span
                className={
                  active
                    ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] text-white"
                    : "rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-[var(--cs-text-muted)]"
                }
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
