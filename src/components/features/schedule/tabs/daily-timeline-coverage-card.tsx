import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { LiveScheduleConflict } from "@/lib/schedule/live-schedule-conflict-types";
import { getShiftGroup } from "./daily-timeline-operations";
import {
  buildScheduleConflictSeverityCounts,
  formatSeveritySummary,
} from "./schedule-conflict-center-model";

type Props = {
  rows: DailyScheduleStaffRow[];
  conflicts: LiveScheduleConflict[];
  groupLabel: string;
  onViewConflictDetails?: () => void;
};
type ShiftCoverage = { rows: DailyScheduleStaffRow[]; clear: number; total: number };
export type DailyTimelineCoverageModel = {
  groupedRows: {
    opening: ShiftCoverage;
    closing: ShiftCoverage;
    regular: ShiftCoverage;
  };
  clearScheduled: number;
  scheduledTotal: number;
  overallPercent: number;
  conflictCount: number;
};

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

function CoverageIssueSummary({
  conflicts,
  onViewConflictDetails,
}: {
  conflicts: LiveScheduleConflict[];
  onViewConflictDetails?: () => void;
}) {
  const counts = buildScheduleConflictSeverityCounts(conflicts);
  const summary = formatSeveritySummary(counts);

  if (conflicts.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-950">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold">All clear</p>
            <p className="mt-0.5 text-[11px] leading-4 text-emerald-900">No schedule issues found</p>
          </div>
          <ShieldCheck className="size-4 shrink-0 text-emerald-700" />
        </div>
      </div>
    );
  }

  const hasCritical = counts.critical > 0;
  const toneClass = hasCritical
    ? "border-red-200 bg-red-50 text-red-950 hover:bg-red-100"
    : "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100";
  const buttonClass = hasCritical
    ? "bg-red-800 text-white hover:bg-red-900"
    : "bg-amber-700 text-white hover:bg-amber-800";

  return (
    <button
      type="button"
      onClick={onViewConflictDetails}
      className={`mt-3 w-full rounded-xl border px-3 py-3 text-left transition ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <AlertTriangle className="size-3.5" />
            Schedule issues
          </p>
          <p className="mt-1 text-[11px] font-bold">{summary}</p>
          <p className="mt-0.5 text-[11px] leading-4 opacity-80">
            Review before confirming the day
          </p>
        </div>
        <span className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[10px] font-bold ${buttonClass}`}>
          Review Issues
          <ChevronRight className="size-3.5" />
        </span>
      </div>
    </button>
  );
}

export function DailyTimelineCoverageCard({
  rows,
  conflicts,
  groupLabel,
  onViewConflictDetails,
}: Props) {
  const model = buildDailyTimelineCoverageModel(rows, conflicts);
  const { groupedRows } = model;

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
          clear={groupedRows.opening.clear}
          total={groupedRows.opening.total}
          tone="bg-emerald-600"
        />
        <CoverageBar
          label="Closing shift"
          clear={groupedRows.closing.clear}
          total={groupedRows.closing.total}
          tone="bg-amber-500"
        />
        {groupedRows.regular.total > 0 ? (
          <CoverageBar
            label="Regular shift"
            clear={groupedRows.regular.clear}
            total={groupedRows.regular.total}
            tone="bg-sky-600"
          />
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md bg-stone-50 px-3 py-2">
        <div>
          <p className="text-[10px] font-semibold text-[var(--cs-text-muted)]">Overall clear coverage</p>
          <p className="text-xs text-[var(--cs-text-secondary)]">
            {model.clearScheduled} / {model.scheduledTotal} scheduled staff
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums text-emerald-700">{model.overallPercent}%</span>
      </div>
      <CoverageIssueSummary conflicts={conflicts} onViewConflictDetails={onViewConflictDetails} />
    </section>
  );
}

export function buildDailyTimelineCoverageModel(
  rows: DailyScheduleStaffRow[],
  conflicts: LiveScheduleConflict[]
): DailyTimelineCoverageModel {
  const conflictedStaff = new Set(
    conflicts
      .filter((conflict) => conflict.type !== "coverage_gap")
      .flatMap((conflict) => conflict.affected_staff_ids)
  );

  const grouped = {
    opening: rows.filter((row) => getShiftGroup(row) === "opening"),
    closing: rows.filter((row) => getShiftGroup(row) === "closing"),
    regular: rows.filter((row) => getShiftGroup(row) === "regular"),
  };
  const toCoverage = (groupRows: DailyScheduleStaffRow[]): ShiftCoverage => ({
    rows: groupRows,
    clear: groupRows.filter((row) => !conflictedStaff.has(row.staff_id)).length,
    total: groupRows.length,
  });
  const scheduled = [...grouped.opening, ...grouped.closing, ...grouped.regular];
  const clearScheduled = scheduled.filter((row) => !conflictedStaff.has(row.staff_id)).length;
  const scheduledTotal = scheduled.length;
  const overallPercent =
    scheduledTotal > 0 ? Math.round((clearScheduled / scheduledTotal) * 100) : 0;

  return {
    groupedRows: {
      opening: toCoverage(grouped.opening),
      closing: toCoverage(grouped.closing),
      regular: toCoverage(grouped.regular),
    },
    clearScheduled,
    scheduledTotal,
    overallPercent,
    conflictCount: conflicts.length,
  };
}
