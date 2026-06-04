"use client";

import { CalendarDays } from "lucide-react";
import { WeeklyRuleDayRow } from "./weekly-rule-day-row";
import {
  SCHEDULE_DAYS,
  type DayPattern,
  type ShiftKind,
} from "./schedule-rule-builder-utils";

type WeeklyRuleMatrixProps = {
  title?: string;
  description?: string;
  pattern: Record<number, DayPattern>;
  visibleKinds: ShiftKind[];
  basePattern?: Record<number, DayPattern>;
  onToggle: (dow: number, field: keyof DayPattern) => void;
};

function shiftLabel(kind: ShiftKind): string {
  if (kind === "opening") return "Opening";
  if (kind === "closing") return "Closing";
  return "Regular";
}

export function WeeklyRuleMatrix({
  title = "Weekly Pattern",
  description,
  pattern,
  visibleKinds,
  basePattern,
  onToggle,
}: WeeklyRuleMatrixProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
          <CalendarDays className="size-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-stone-950">{title}</h3>
          {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[minmax(110px,1fr)_repeat(3,132px)] gap-3 border-b border-stone-200 pb-3 text-xs font-bold uppercase tracking-wide text-stone-500 data-[mode=regular]:grid-cols-[minmax(110px,1fr)_repeat(2,150px)]" data-mode={visibleKinds.length === 1 ? "regular" : "split"}>
            <div>Day</div>
            {visibleKinds.map((kind) => (
              <div key={kind} className="text-center">
                {shiftLabel(kind)}
              </div>
            ))}
            <div className="text-center">Day Off</div>
          </div>

          {SCHEDULE_DAYS.map((day) => {
            const row = pattern[day.dow] ?? {
              opening: false,
              closing: false,
              regular: false,
              dayOff: false,
            };
            const baseRow = basePattern?.[day.dow];

            return (
              <WeeklyRuleDayRow
                key={day.dow}
                day={day}
                pattern={row}
                visibleKinds={visibleKinds}
                basePattern={baseRow}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
