"use client";

import { ShiftTogglePill } from "./shift-toggle-pill";
import {
  patternsMatchForDay,
  type DayPattern,
  type ShiftKind,
} from "./schedule-rule-builder-utils";

type WeeklyRuleDayRowProps = {
  day: { dow: number; label: string };
  pattern: DayPattern;
  visibleKinds: ShiftKind[];
  basePattern?: DayPattern;
  onToggle: (dow: number, field: keyof DayPattern) => void;
};

function shiftLabel(kind: ShiftKind): string {
  if (kind === "opening") return "Opening";
  if (kind === "closing") return "Closing";
  return "Regular";
}

export function WeeklyRuleDayRow({
  day,
  pattern,
  visibleKinds,
  basePattern,
  onToggle,
}: WeeklyRuleDayRowProps) {
  const custom =
    basePattern !== undefined && !patternsMatchForDay(pattern, basePattern, visibleKinds);

  return (
    <div className="grid min-w-[520px] grid-cols-[minmax(110px,1fr)_repeat(3,132px)] items-center gap-3 border-b border-stone-100 py-3 last:border-b-0 data-[mode=regular]:grid-cols-[minmax(110px,1fr)_repeat(2,150px)]" data-mode={visibleKinds.length === 1 ? "regular" : "split"}>
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-950">
        <span>{day.label}</span>
        {custom ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
            Custom
          </span>
        ) : null}
      </div>
      {visibleKinds.map((kind) => (
        <div key={kind} className="flex justify-center">
          <ShiftTogglePill
            label={shiftLabel(kind)}
            kind={kind}
            active={pattern[kind]}
            custom={custom && pattern[kind] !== basePattern?.[kind]}
            onToggle={() => onToggle(day.dow, kind)}
          />
        </div>
      ))}
      <div className="flex justify-center">
        <ShiftTogglePill
          label="Day Off"
          kind="dayOff"
          active={pattern.dayOff}
          custom={custom && pattern.dayOff !== basePattern?.dayOff}
          onToggle={() => onToggle(day.dow, "dayOff")}
        />
      </div>
    </div>
  );
}
