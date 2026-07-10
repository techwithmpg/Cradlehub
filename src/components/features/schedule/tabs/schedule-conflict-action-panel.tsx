import { ArrowRight, Clock3, Info, UserRound, X } from "lucide-react";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
} from "@/lib/schedule/live-schedule-conflict-types";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import { getConflictTypeLabel } from "./schedule-conflict-center-model";

export type ScheduleConflictActionSelection = {
  conflict: LiveScheduleConflict;
  action: LiveScheduleConflictQuickAction;
};

type Props = {
  selection: ScheduleConflictActionSelection;
  onRunAction: (
    conflict: LiveScheduleConflict,
    action: LiveScheduleConflictQuickAction
  ) => void;
  onClear: () => void;
};

function formatConflictTime(conflict: LiveScheduleConflict): string {
  if (!conflict.start_time || !conflict.end_time) return "All day";
  return `${formatScheduleTime(conflict.start_time)} - ${formatScheduleTime(conflict.end_time)}`;
}

export function ScheduleConflictActionPanel({
  selection,
  onRunAction,
  onClear,
}: Props) {
  const { conflict, action } = selection;

  return (
    <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            Action preview
          </p>
          <h4 className="mt-1 text-sm font-bold">{action.label}</h4>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex size-7 items-center justify-center rounded-full bg-white/80 text-emerald-900 transition hover:bg-white"
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear selected action</span>
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] leading-5 sm:grid-cols-3">
        <div className="rounded-xl bg-white/70 px-2.5 py-2">
          <p className="flex items-center gap-1 font-bold">
            <Info className="size-3" />
            Issue
          </p>
          <p className="mt-1 text-emerald-900">{getConflictTypeLabel(conflict.type)}</p>
        </div>
        <div className="rounded-xl bg-white/70 px-2.5 py-2">
          <p className="flex items-center gap-1 font-bold">
            <UserRound className="size-3" />
            Staff
          </p>
          <p className="mt-1 text-emerald-900">
            {conflict.affected_staff_names.join(", ") || "Not staff-specific"}
          </p>
        </div>
        <div className="rounded-xl bg-white/70 px-2.5 py-2">
          <p className="flex items-center gap-1 font-bold">
            <Clock3 className="size-3" />
            Time
          </p>
          <p className="mt-1 text-emerald-900">{formatConflictTime(conflict)}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-emerald-900">
        This uses the existing schedule and booking tools. The modal stays open so the team can keep reviewing the issue list.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRunAction(conflict, action)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-[11px] font-bold text-white transition hover:bg-emerald-900"
        >
          Continue safely
          <ArrowRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 items-center rounded-lg border border-emerald-200 bg-white px-3 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-100"
        >
          Choose another action
        </button>
      </div>
    </aside>
  );
}
