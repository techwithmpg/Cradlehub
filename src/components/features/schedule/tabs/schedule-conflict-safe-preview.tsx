import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { ScheduleConflictResolutionIssue } from "./schedule-conflict-center-model";
import { getConflictTypeLabel } from "./schedule-conflict-center-model";

type Props = {
  issue: ScheduleConflictResolutionIssue;
};

const impactChecks = [
  "Booking still fits valid availability",
  "Staff remains available and qualified",
  "Room/bed/resource is available for the branch",
  "No new booking overlap is created",
  "No blocked time conflict remains",
  "Home-service travel buffer stays safe",
  "Online booking rules are not violated",
];

export function ScheduleConflictSafePreview({ issue }: Props) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
      <div className="flex items-start gap-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80">
          <ShieldAlert className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">Safe fix preview</p>
          <p className="mt-1 text-[11px] leading-5 text-emerald-900">
            Before a fix is saved, use the existing booking/schedule tools to validate the before and after state for{" "}
            <span className="font-bold">{getConflictTypeLabel(issue.conflict.type)}</span>. The issue should only clear
            after schedule data refreshes and the backend no longer returns the same conflict.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {impactChecks.map((check) => (
          <div key={check} className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900">
            <CheckCircle2 className="size-3.5 text-emerald-700" />
            {check}
          </div>
        ))}
      </div>
    </div>
  );
}
