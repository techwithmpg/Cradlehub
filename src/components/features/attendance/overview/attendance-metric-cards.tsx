import { AlertTriangle, CheckCircle2, Clock3, UsersRound } from "lucide-react";
import type { ComponentType } from "react";
import type { AttendanceOverviewSummary } from "@/lib/attendance/overview-summary";

type MetricTone = "success" | "warning" | "info" | "error";

type MetricCardProps = {
  label: string;
  value: number;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: MetricTone;
};

const TONE_CLASSES: Record<MetricTone, { shell: string; icon: string }> = {
  success: {
    shell: "border-[var(--cs-success)]/20",
    icon: "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  },
  warning: {
    shell: "border-[var(--cs-warning)]/20",
    icon: "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
  },
  info: {
    shell: "border-[var(--cs-info)]/20",
    icon: "bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]",
  },
  error: {
    shell: "border-[var(--cs-error)]/20",
    icon: "bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]",
  },
};

function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <article
      className={`flex min-h-[116px] items-center gap-3 rounded-[var(--cs-r-lg)] border bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] ${classes.shell}`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-full ${classes.icon}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-xs font-semibold text-[var(--cs-text-secondary)]">{label}</p>
        <p className="m-0 mt-0.5 text-2xl font-bold leading-none text-[var(--cs-text)]">{value}</p>
        <p className="m-0 mt-2 truncate text-xs text-[var(--cs-text-muted)]">{detail}</p>
      </div>
    </article>
  );
}

export function AttendanceMetricCards({ summary }: { summary: AttendanceOverviewSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="On duty"
        value={summary.onDuty}
        detail="Currently working"
        icon={UsersRound}
        tone="success"
      />
      <MetricCard
        label="Not in yet"
        value={summary.notInYet}
        detail="Expected today"
        icon={Clock3}
        tone="warning"
      />
      <MetricCard
        label="Completed"
        value={summary.completed}
        detail="Finished shifts"
        icon={CheckCircle2}
        tone="info"
      />
      <MetricCard
        label="Needs review"
        value={summary.reviewItems}
        detail={`${summary.needsReviewStaff} staff affected`}
        icon={AlertTriangle}
        tone="error"
      />
    </div>
  );
}
