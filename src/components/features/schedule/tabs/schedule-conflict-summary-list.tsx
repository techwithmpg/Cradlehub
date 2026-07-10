import { AlertOctagon, CheckCircle2, ClipboardCheck, Info, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ScheduleConflictImpactCounts,
  ScheduleConflictImpactGroup,
  ScheduleConflictTabKey,
} from "./schedule-conflict-center-model";
import {
  formatIssueCount,
  getImpactGroupCopy,
} from "./schedule-conflict-center-model";

type Props = {
  counts: ScheduleConflictImpactCounts;
  activeTab: ScheduleConflictTabKey;
  onTabChange: (tab: ScheduleConflictTabKey) => void;
};

const summaryItems: Array<{
  group: ScheduleConflictImpactGroup;
  tab: ScheduleConflictTabKey;
  icon: LucideIcon;
  className: string;
}> = [
  {
    group: "must_fix",
    tab: "must_fix",
    icon: AlertOctagon,
    className: "border-red-200 bg-red-50 text-red-950",
  },
  {
    group: "needs_approval",
    tab: "needs_approval",
    icon: ClipboardCheck,
    className: "border-amber-200 bg-amber-50 text-amber-950",
  },
  {
    group: "cleanup_warning",
    tab: "cleanup",
    icon: Wrench,
    className: "border-yellow-200 bg-yellow-50 text-yellow-950",
  },
  {
    group: "informational",
    tab: "all",
    icon: Info,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  {
    group: "accepted",
    tab: "accepted",
    icon: CheckCircle2,
    className: "border-stone-200 bg-white text-stone-900",
  },
];

export function ScheduleConflictSummaryList({
  counts,
  activeTab,
  onTabChange,
}: Props) {
  const totalIssues =
    counts.must_fix + counts.needs_approval + counts.cleanup_warning + counts.informational + counts.accepted;

  if (totalIssues === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4" />
          All clear
        </div>
        <p className="mt-2 text-xs leading-5 text-emerald-900">
          No schedule issues were found for this schedule window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summaryItems.map(({ group, tab, icon: Icon, className }) => {
        const copy = getImpactGroupCopy(group);
        const count = counts[group];
        const active = activeTab === tab || (group === "informational" && activeTab === "all");

        return (
          <button
            key={group}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm motion-reduce:hover:translate-y-0 ${
              className
            } ${active ? "ring-2 ring-emerald-700/25" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/70">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold">{copy.label}</p>
                  <p className="mt-1 text-[11px] leading-4 opacity-80">{copy.description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                {formatIssueCount(count)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
