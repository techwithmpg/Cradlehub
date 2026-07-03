"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Clock, Info, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftDefinitionCard } from "./shift-definition-card";
import { WeeklyRuleMatrix } from "./weekly-rule-matrix";
import {
  ALL_SHIFT_KINDS,
  SCHEDULE_DAYS,
  activeDayLabels,
  clonePattern,
  extractShiftTimesForGroup,
  formatDayList,
  getGroupScheduleConfig,
  getRuleShiftType,
  getShiftDisplay,
  getShiftLabel,
  getVisibleShiftKinds,
  rulesToPatternForGroup,
  type DayPattern,
  type ShiftKind,
  type ShiftTimes,
} from "./schedule-rule-builder-utils";
import {
  deleteStaffGroupScheduleRuleAction,
  upsertStaffGroupScheduleRuleAction,
} from "@/lib/actions/staff-schedule-groups";
import type { StaffGroupScheduleRule, StaffScheduleGroup } from "@/lib/queries/staff-schedule-groups";

export type { DayPattern, ShiftTimes } from "./schedule-rule-builder-utils";
export { SCHEDULE_DAYS, formatDayList } from "./schedule-rule-builder-utils";

export const DEFAULT_SHIFT_TIMES: ShiftTimes = {
  opening: { start: "10:00", end: "17:30" },
  closing: { start: "14:00", end: "22:30" },
  regular: { start: "10:00", end: "17:30" },
};

export const SHIFT_STYLE: Record<ShiftKind, { dot: string; badge: string; bg: string }> = {
  opening: { dot: "var(--cs-success)", badge: "#4A7C59", bg: "rgba(74,124,89,0.12)" },
  closing: { dot: "var(--cs-info)", badge: "#2563EB", bg: "rgba(37,99,235,0.12)" },
  regular: { dot: "var(--cs-sand)", badge: "var(--cs-sand-dark)", bg: "rgba(166,123,91,0.12)" },
};

export function dayAbbr(label: string): string {
  return label.slice(0, 3);
}

export function extractShiftTimes(rules: StaffGroupScheduleRule[]): ShiftTimes {
  return extractShiftTimesForGroup(rules, "therapist");
}

function toMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.slice(0, 5).split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTimeLabel(value: number): string {
  const hour = Math.floor(value / 60) % 24;
  const minute = value % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function computeOverlap(
  opening: { start: string; end: string },
  closing: { start: string; end: string }
): string | null {
  const start = Math.max(toMinutes(opening.start), toMinutes(closing.start));
  const end = Math.min(toMinutes(opening.end), toMinutes(closing.end));
  if (end <= start) return null;

  const duration = end - start;
  const durationLabel =
    duration % 60 > 0
      ? `${Math.floor(duration / 60)}h ${duration % 60}m`
      : `${Math.floor(duration / 60)}h`;

  return `${minutesToTimeLabel(start)} - ${minutesToTimeLabel(end)} (${durationLabel})`;
}

type GroupScheduleRulesPanelProps = {
  selectedGroup: string;
  groupData?: StaffScheduleGroup;
  groupRules: StaffGroupScheduleRule[];
  staffCount?: number;
  onDataRefresh?: () => void;
};

function togglePatternField(
  previous: Record<number, DayPattern>,
  dow: number,
  field: keyof DayPattern,
  visibleKinds: ShiftKind[]
) {
  const next = clonePattern(previous);
  const row = next[dow];
  if (!row) return previous;

  if (field === "dayOff") {
    const nextValue = !row.dayOff;
    row.dayOff = nextValue;
    if (nextValue) {
      for (const kind of visibleKinds) {
        row[kind] = false;
      }
    }
    return next;
  }

  row[field] = !row[field];
  if (row[field]) {
    row.dayOff = false;
  }

  return next;
}

function ScheduleSummary({
  pattern,
  times,
  visibleKinds,
}: {
  pattern: Record<number, DayPattern>;
  times: ShiftTimes;
  visibleKinds: ShiftKind[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
      <h3 className="text-base font-bold text-stone-950">Schedule Summary (Default Times)</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ALL_SHIFT_KINDS.map((kind) => {
          const used = visibleKinds.includes(kind);
          const display = getShiftDisplay(kind, times);

          return (
            <div key={kind} className="border-r border-stone-100 pr-4 last:border-r-0">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-950">
                <span
                  className={
                    kind === "opening"
                      ? "size-2 rounded-full bg-emerald-700"
                      : kind === "closing"
                        ? "size-2 rounded-full bg-blue-800"
                        : "size-2 rounded-full bg-amber-700"
                  }
                />
                {getShiftLabel(kind)}
              </div>
              <p className="mt-2 text-sm text-stone-500">
                {used ? formatDayList(activeDayLabels(pattern, kind)) : "Not used for this group"}
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {used ? (
                  <>
                    {display.label}
                    {display.isOvernight ? (
                      <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                        +1 day
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Not used"
                )}
              </p>
            </div>
          );
        })}
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-stone-950">
            <span className="size-2 rounded-full bg-stone-500" />
            Day Off
          </div>
          <p className="mt-2 text-sm text-stone-500">{formatDayList(activeDayLabels(pattern, "dayOff"))}</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">All day</p>
        </div>
      </div>
    </section>
  );
}

function TimeEditor({
  visibleKinds,
  times,
  onChange,
}: {
  visibleKinds: ShiftKind[];
  times: ShiftTimes;
  onChange: (kind: ShiftKind, field: keyof ShiftTimes[ShiftKind], value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-amber-950">
        <Clock className="size-4" />
        Edit Group Times
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {visibleKinds.map((kind) => (
          <label key={kind} className="grid gap-2 rounded-xl border border-white/70 bg-white/70 p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
              {getShiftLabel(kind)}
            </span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="time"
                value={times[kind].start}
                onChange={(event) => onChange(kind, "start", event.target.value)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900"
              />
              <span className="text-stone-400">-</span>
              <input
                type="time"
                value={times[kind].end}
                onChange={(event) => onChange(kind, "end", event.target.value)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900"
              />
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

export function GroupScheduleRulesPanel({
  selectedGroup,
  groupData,
  groupRules,
  staffCount = 0,
  onDataRefresh,
}: GroupScheduleRulesPanelProps) {
  const config = getGroupScheduleConfig(selectedGroup);
  const groupId = groupData?.id;
  const visibleKinds = useMemo(() => getVisibleShiftKinds(selectedGroup), [selectedGroup]);
  const initialPattern = useMemo(
    () => rulesToPatternForGroup(groupRules, selectedGroup),
    [groupRules, selectedGroup]
  );
  const initialTimes = useMemo(
    () => extractShiftTimesForGroup(groupRules, selectedGroup),
    [groupRules, selectedGroup]
  );

  const [pattern, setPattern] = useState(() => initialPattern);
  const [times, setTimes] = useState(() => initialTimes);
  const [editingTimes, setEditingTimes] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = useCallback(
    (dow: number, field: keyof DayPattern) => {
      setPattern((previous) => togglePatternField(previous, dow, field, visibleKinds));
      setDirty(true);
    },
    [visibleKinds]
  );

  const handleTimeChange = useCallback(
    (kind: ShiftKind, field: keyof ShiftTimes[ShiftKind], value: string) => {
      setTimes((previous) => ({
        ...previous,
        [kind]: {
          ...previous[kind],
          [field]: value,
        },
      }));
      setDirty(true);
    },
    []
  );

  const resetPanel = useCallback(() => {
    setPattern(initialPattern);
    setTimes(initialTimes);
    setEditingTimes(false);
    setDirty(false);
    setFeedback(null);
  }, [initialPattern, initialTimes]);

  const savePattern = useCallback(() => {
    if (!groupId) {
      setFeedback({ tone: "error", message: "This group has no saved rule container yet." });
      return;
    }

    startTransition(async () => {
      const promises: Promise<{ success: boolean; error?: string }>[] = [];

      for (const { dow } of SCHEDULE_DAYS) {
        const row = pattern[dow];
        if (!row) continue;

        for (const kind of ALL_SHIFT_KINDS) {
          const shiftType = getRuleShiftType(kind);
          const isVisible = visibleKinds.includes(kind);
          const isActive = isVisible && row[kind] && !row.dayOff;

          if (isActive) {
            promises.push(
              upsertStaffGroupScheduleRuleAction({
                groupId,
                dayOfWeek: dow,
                shiftType,
                startTime: times[kind].start,
                endTime: times[kind].end,
                isDayOff: false,
                isActive: true,
              })
            );
          } else {
            promises.push(deleteStaffGroupScheduleRuleAction({ groupId, dayOfWeek: dow, shiftType }));
          }
        }

        if (row.dayOff) {
          promises.push(
            upsertStaffGroupScheduleRuleAction({
              groupId,
              dayOfWeek: dow,
              shiftType: "single",
              startTime: null,
              endTime: null,
              isDayOff: true,
              isActive: true,
            })
          );
        }
      }

      const results = await Promise.all(promises);
      const failed = results.find((result) => !result.success);

      if (failed) {
        setFeedback({ tone: "error", message: failed.error ?? "Some rules failed to save." });
        return;
      }

      setDirty(false);
      setEditingTimes(false);
      setFeedback({ tone: "success", message: "Group schedule rules saved." });
      onDataRefresh?.();
      window.setTimeout(() => setFeedback(null), 3000);
    });
  }, [groupId, onDataRefresh, pattern, times, visibleKinds]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-900">
              <Clock className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-950">{config.label} - Weekly Rules</h2>
              <p className="mt-1 text-sm font-medium text-stone-500">
                {staffCount} staff member{staffCount === 1 ? "" : "s"} · {config.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-emerald-200 bg-white/80 text-emerald-900 hover:bg-emerald-50"
              onClick={() => setEditingTimes((current) => !current)}
            >
              <Clock className="size-4" />
              {editingTimes ? "Done Editing" : "Edit Times"}
            </Button>
            <Button
              type="button"
              disabled={!dirty || isPending}
              className="bg-emerald-900 text-white hover:bg-emerald-800"
              onClick={savePattern}
            >
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save Rules"}
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={resetPanel}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-6 text-stone-600">{config.description}</p>

        {feedback ? (
          <div
            className={
              feedback.tone === "success"
                ? "mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
                : "mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            }
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {visibleKinds.map((kind) => (
            <ShiftDefinitionCard
              key={kind}
              kind={kind}
              groupId={selectedGroup}
              times={times}
              onEditTime={() => setEditingTimes(true)}
            />
          ))}
        </div>
      </section>

      {editingTimes ? (
        <TimeEditor visibleKinds={visibleKinds} times={times} onChange={handleTimeChange} />
      ) : null}

      <WeeklyRuleMatrix
        pattern={pattern}
        visibleKinds={visibleKinds}
        onToggle={handleToggle}
        description="Set which shifts are active for each day."
      />

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-bold">Tip:</span>{" "}
          {config.mode === "opening_closing"
            ? `Changes here affect the default weekly pattern for all ${config.label} staff unless overridden in Individual Adjustments.`
            : "This group uses regular working hours. Use Individual Adjustments only for special cases."}
        </p>
      </div>

      <ScheduleSummary pattern={pattern} times={times} visibleKinds={visibleKinds} />
    </div>
  );
}
