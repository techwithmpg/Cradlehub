"use client";

import { CheckCircle2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/utils/time-format";
import type { OpenCloseNormalizationCandidate } from "./adjust-schedule-types";
import { ADJUST_SCHEDULE_DAYS } from "./adjust-schedule-utils";

type OpenCloseNormalizationAlertProps = {
  candidates: OpenCloseNormalizationCandidate[];
  completedRepairs: OpenCloseNormalizationCandidate[];
  onFixAutomatically: () => void;
  onReviewManually: () => void;
};

function dayLabel(dayOfWeek: number): string {
  return ADJUST_SCHEDULE_DAYS.find((day) => day.dayOfWeek === dayOfWeek)?.short ?? "Day";
}

function repairDescription(candidate: OpenCloseNormalizationCandidate): string {
  const nextDay = candidate.closingEndsNextDay ? " next day" : "";
  return `${dayLabel(candidate.dayOfWeek)}: Opening ${formatTime12h(candidate.openingStartTime)}–${formatTime12h(candidate.previousOpeningEndTime)} becomes ${formatTime12h(candidate.openingStartTime)}–${formatTime12h(candidate.closingStartTime)}; Closing stays ${formatTime12h(candidate.closingStartTime)}–${formatTime12h(candidate.closingEndTime)}${nextDay}.`;
}

export function OpenCloseNormalizationAlert({
  candidates,
  completedRepairs,
  onFixAutomatically,
  onReviewManually,
}: OpenCloseNormalizationAlertProps) {
  if (candidates.length === 0 && completedRepairs.length === 0) return null;

  if (candidates.length === 0) {
    return (
      <section
        aria-live="polite"
        className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="text-sm font-bold">Open–Close schedule corrected</h3>
            <p className="mt-1 text-xs leading-5">
              Opening now ends when Closing begins. The draft remains unsaved until you select Save
              Adjustment.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {completedRepairs.map((candidate) => (
                <li key={candidate.dayOfWeek}>{repairDescription(candidate)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex items-start gap-3">
        <WandSparkles className="mt-0.5 size-5 shrink-0 text-amber-800" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">Opening and closing coverage overlap</h3>
          <p className="mt-1 text-xs leading-5">
            This staff member is covering both opening and closing duties. Convert the schedule into
            one continuous Open–Close workday without counting the overlapping hours twice.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {candidates.map((candidate) => (
              <li key={candidate.dayOfWeek}>{repairDescription(candidate)}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#07552f] text-white hover:bg-[#064525]"
              onClick={onFixAutomatically}
            >
              <WandSparkles className="size-3.5" />
              Fix automatically
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onReviewManually}>
              Review manually
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
