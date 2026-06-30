"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  CarFront,
  Leaf,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import type {
  StaffGroupKey,
  TimelineFilters,
} from "./daily-timeline-operations";

const GROUP_ICONS = {
  all: Users,
  therapist: UserRound,
  front_desk: BriefcaseBusiness,
  salon: Sparkles,
  aesthetician: Leaf,
  utility: Wrench,
  driver: CarFront,
  managerial: Settings2,
  other: Users,
} satisfies Record<StaffGroupKey, typeof Users>;

type GroupOption = { key: StaffGroupKey; label: string; count: number };

type Props = {
  branchName: string;
  groups: GroupOption[];
  activeGroup: StaffGroupKey;
  filters: TimelineFilters;
  onGroupChange: (group: StaffGroupKey) => void;
  onFiltersChange: (filters: TimelineFilters) => void;
  onCheckAvailability: () => void;
  onBlockStaffTime: () => void;
  onOpenScheduleSetup: () => void;
};

export function DailyTimelineToolbar({
  branchName,
  groups,
  activeGroup,
  filters,
  onGroupChange,
  onFiltersChange,
  onCheckAvailability,
  onBlockStaffTime,
  onOpenScheduleSetup,
}: Props) {
  const setFilter = <Key extends keyof TimelineFilters>(key: Key, value: TimelineFilters[Key]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cs-text)]">
          <CalendarClock className="size-4 text-emerald-700" />
          Daily operations
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCheckAvailability}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            <Search className="size-3.5" />
            Check Availability
          </button>
          <button
            type="button"
            onClick={onBlockStaffTime}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)]"
          >
            <CalendarClock className="size-3.5" />
            Block Staff Time
          </button>
          <button
            type="button"
            onClick={onOpenScheduleSetup}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-800 px-3 text-xs font-semibold text-white transition hover:bg-emerald-900"
          >
            <Settings2 className="size-3.5" />
            Open Schedule Setup
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-y border-[var(--cs-border-soft)] py-2">
        {groups.map((group) => {
          const Icon = GROUP_ICONS[group.key];
          const selected = activeGroup === group.key;
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onGroupChange(group.key)}
              className={
                selected
                  ? "flex h-9 shrink-0 items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900"
                  : "flex h-9 shrink-0 items-center gap-2 rounded-md border border-transparent px-3 text-xs font-medium text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-soft)] hover:bg-[var(--cs-surface)]"
              }
            >
              <Icon className="size-3.5" />
              {group.label}
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] tabular-nums">
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-2 md:grid-cols-[180px_150px_160px_minmax(220px,1fr)_auto]">
        <label className="sr-only" htmlFor="daily-timeline-branch">Branch</label>
        <select
          id="daily-timeline-branch"
          value={branchName}
          disabled
          className="h-10 min-w-0 rounded-md border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 text-xs font-semibold text-[var(--cs-text)] disabled:opacity-100"
        >
          <option value={branchName}>{branchName}</option>
        </select>

        <label className="sr-only" htmlFor="daily-timeline-shift">Shift</label>
        <select
          id="daily-timeline-shift"
          value={filters.shift}
          onChange={(event) => setFilter("shift", event.target.value as TimelineFilters["shift"])}
          className="h-10 rounded-md border border-[var(--cs-border-soft)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)]"
        >
          <option value="all">All Shifts</option>
          <option value="opening">Opening</option>
          <option value="regular">Regular</option>
          <option value="closing">Closing</option>
          <option value="off">Day Off</option>
        </select>

        <label className="sr-only" htmlFor="daily-timeline-status">Status</label>
        <select
          id="daily-timeline-status"
          value={filters.status}
          onChange={(event) => setFilter("status", event.target.value as TimelineFilters["status"])}
          className="h-10 rounded-md border border-[var(--cs-border-soft)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)]"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available Now</option>
          <option value="busy">Busy Now</option>
          <option value="scheduled">Scheduled</option>
          <option value="off">Off Today</option>
        </select>

        <label className="relative block min-w-0" htmlFor="daily-timeline-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
          <input
            id="daily-timeline-search"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Search staff by name or nickname"
            className="h-10 w-full rounded-md border border-[var(--cs-border-soft)] bg-white pl-9 pr-3 text-xs text-[var(--cs-text)] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <button
          type="button"
          onClick={() => onFiltersChange({ query: "", shift: "all", status: "all" })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          <SlidersHorizontal className="size-3.5" />
          Clear Filters
        </button>
      </div>
    </div>
  );
}
