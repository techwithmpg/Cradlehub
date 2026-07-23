import type { CSSProperties } from "react";
import { Panel } from "@/components/features/attendance/attendance-ui";
import type { AttendanceOverviewSummary } from "@/lib/attendance/overview-summary";

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function LegendRow({
  label,
  value,
  total,
  dotClassName,
}: {
  label: string;
  value: number;
  total: number;
  dotClassName: string;
}) {
  return (
    <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      <span className={`size-2.5 rounded-full ${dotClassName}`} />
      <span className="truncate text-[var(--cs-text-secondary)]">{label}</span>
      <span className="font-semibold text-[var(--cs-text)]">
        {value}{" "}
        <span className="font-normal text-[var(--cs-text-muted)]">({percent(value, total)}%)</span>
      </span>
    </div>
  );
}

export function TodayAtAGlance({ summary }: { summary: AttendanceOverviewSummary }) {
  const total = summary.scheduledTotal;
  const ratio = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const onDutyEnd = ratio(summary.onDuty);
  const completedEnd = onDutyEnd + ratio(summary.completed);
  const notInYetEnd = completedEnd + ratio(summary.notInYet);
  const chartStyle: CSSProperties = {
    background:
      total > 0
        ? `conic-gradient(var(--cs-success) 0% ${onDutyEnd}%, var(--cs-info) ${onDutyEnd}% ${completedEnd}%, var(--cs-warning) ${completedEnd}% ${notInYetEnd}%, var(--cs-error) ${notInYetEnd}% 100%)`
        : "var(--cs-neutral-bg)",
  };

  return (
    <Panel title="Today at a glance" className="h-full">
      <div className="grid items-center gap-4 sm:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[104px_minmax(0,1fr)]">
        <div className="relative mx-auto size-24 rounded-full p-3" style={chartStyle}>
          <div className="flex size-full flex-col items-center justify-center rounded-full bg-[var(--cs-surface)] shadow-inner">
            <span className="text-xl font-bold leading-none text-[var(--cs-text)]">{total}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Scheduled
            </span>
          </div>
        </div>

        <div className="grid gap-2.5">
          <LegendRow
            label="On duty"
            value={summary.onDuty}
            total={total}
            dotClassName="bg-[var(--cs-success)]"
          />
          <LegendRow
            label="Completed"
            value={summary.completed}
            total={total}
            dotClassName="bg-[var(--cs-info)]"
          />
          <LegendRow
            label="Not in yet"
            value={summary.notInYet}
            total={total}
            dotClassName="bg-[var(--cs-warning)]"
          />
          <LegendRow
            label="Needs review"
            value={summary.needsReviewStaff}
            total={total}
            dotClassName="bg-[var(--cs-error)]"
          />
        </div>
      </div>

      {summary.offDuty > 0 ? (
        <p className="m-0 border-t border-[var(--cs-border-soft)] pt-3 text-xs text-[var(--cs-text-muted)]">
          {summary.offDuty} active staff {summary.offDuty === 1 ? "member is" : "members are"} off
          duty or not scheduled today.
        </p>
      ) : null}
    </Panel>
  );
}
