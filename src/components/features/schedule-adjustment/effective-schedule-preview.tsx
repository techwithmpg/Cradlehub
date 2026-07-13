"use client";

import { cn } from "@/lib/utils";
import type { AdjustScheduleDraft, ScheduleShiftKind } from "./adjust-schedule-types";
import {
  ADJUST_SCHEDULE_DAYS,
  formatDuration,
  formatWindowTime,
  getShiftLabel,
  getWeeklyDurationMinutes,
} from "./adjust-schedule-utils";

type EffectiveSchedulePreviewProps = {
  draft: AdjustScheduleDraft;
  effectiveLabel: string;
};

const DOT_CLASS: Record<ScheduleShiftKind, string> = {
  opening: "bg-[#0f7a4c]",
  regular: "bg-[#2563eb]",
  closing: "bg-[#9b4cc2]",
};

const TEXT_CLASS: Record<ScheduleShiftKind, string> = {
  opening: "text-[#0f6b43]",
  regular: "text-[#1d5fd0]",
  closing: "text-[#9247b6]",
};

export function EffectiveSchedulePreview({ draft, effectiveLabel }: EffectiveSchedulePreviewProps) {
  const totalMinutes = getWeeklyDurationMinutes(draft);

  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-[#181713]">Schedule Preview</p>
      <p className="mt-2 text-xs text-[#615c52]">Effective: {effectiveLabel}</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-[#eee8dc]">
        {ADJUST_SCHEDULE_DAYS.map((dayMeta) => {
          const day = draft.days.find((candidate) => candidate.dayOfWeek === dayMeta.dayOfWeek);
          if (!day) return null;

          return (
            <div
              key={dayMeta.dayOfWeek}
              className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 border-b border-[#eee8dc] px-3 py-2 text-xs last:border-b-0"
            >
              <span className="font-semibold text-[#181713]">{dayMeta.short}</span>
              <div className="min-w-0">
                {day.mode === "day_off" ? (
                  <span className="text-[#615c52]">Day Off</span>
                ) : day.mode === "unconfigured" ? (
                  <span className="text-[#8a8378]">Not Configured</span>
                ) : (
                  <div className="space-y-1">
                    {day.windows.map((window) => (
                      <div key={window.id} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <span className={cn("flex min-w-0 items-center gap-2 font-semibold", TEXT_CLASS[window.shiftKind])}>
                          <span className={cn("size-2 rounded-full", DOT_CLASS[window.shiftKind])} />
                          {getShiftLabel(window.shiftKind)}
                        </span>
                        <span className="text-[#4f4a42]">{formatWindowTime(window)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between bg-[#fbfaf7] px-3 py-3 text-sm">
          <span className="font-semibold text-[#181713]">Total Weekly Hours</span>
          <span className="font-bold text-[#181713]">{formatDuration(totalMinutes)}</span>
        </div>
      </div>
    </section>
  );
}
