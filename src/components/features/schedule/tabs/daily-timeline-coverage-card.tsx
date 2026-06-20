import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { DailyTimelineAlert } from "./daily-timeline-alerts";
import { getShiftGroup } from "./daily-timeline-operations";

type Props = { rows: DailyScheduleStaffRow[]; alerts: DailyTimelineAlert[]; groupLabel: string };

function CoverageBar({ label, clear, total, tone }: { label: string; clear: number; total: number; tone: string }) {
  const percent = total > 0 ? Math.round((clear / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-[var(--cs-text-secondary)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--cs-text)]">{clear} / {total}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-right text-[9px] font-semibold text-[var(--cs-text-muted)]">{percent}% clear</p>
    </div>
  );
}

export function DailyTimelineCoverageCard({ rows, alerts, groupLabel }: Props) {
  const conflicts = alerts.filter(
    (alert) => alert.type === "resource_conflict" || alert.type === "staff_conflict"
  );
  const conflictedStaff = new Set(
    conflicts.map((alert) => alert.staffId)
  );
  const opening = rows.filter((row) => getShiftGroup(row) === "opening");
  const closing = rows.filter((row) => getShiftGroup(row) === "closing");
  const scheduled = rows.filter((row) => getShiftGroup(row) !== "off");
  const clearScheduled = scheduled.filter((row) => !conflictedStaff.has(row.staff_id)).length;
  const overall = rows.length > 0 ? Math.round((clearScheduled / rows.length) * 100) : 0;

  return (
    <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
          <ShieldCheck className="size-4 text-emerald-700" />
          Coverage Overview
        </h3>
        <span className="text-[10px] font-medium text-[var(--cs-text-muted)]">{groupLabel}</span>
      </div>
      <div className="mt-4 space-y-3">
        <CoverageBar
          label="Opening shift"
          clear={opening.filter((row) => !conflictedStaff.has(row.staff_id)).length}
          total={opening.length}
          tone="bg-emerald-600"
        />
        <CoverageBar
          label="Closing shift"
          clear={closing.filter((row) => !conflictedStaff.has(row.staff_id)).length}
          total={closing.length}
          tone="bg-amber-500"
        />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md bg-stone-50 px-3 py-2">
        <div>
          <p className="text-[10px] font-semibold text-[var(--cs-text-muted)]">Overall clear coverage</p>
          <p className="text-xs text-[var(--cs-text-secondary)]">{clearScheduled} / {rows.length} staff</p>
        </div>
        <span className="text-lg font-bold tabular-nums text-emerald-700">{overall}%</span>
      </div>
      {conflicts.length > 0 ? (
        <div className="mt-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-800">
          <span className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" />Conflicts</span>
          <span className="font-bold tabular-nums">{conflicts.length}</span>
        </div>
      ) : null}
    </section>
  );
}
