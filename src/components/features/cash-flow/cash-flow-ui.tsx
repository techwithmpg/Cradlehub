import type { ReactNode } from "react";
import { WorkspaceSection } from "@/components/features/attendance/attendance-ui";

export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);

export const fieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-medium text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/15";

type Tone = "neutral" | "success" | "warning" | "info";

const STATUS_TONE: Record<Tone, string> = {
  neutral:
    "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)]",
  success:
    "border-[var(--cs-success)]/20 bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function CashFlowStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const METRIC_TONE: Record<Tone, { shell: string; dot: string }> = {
  neutral: {
    shell: "border-[var(--cs-border-soft)]",
    dot: "bg-[var(--cs-text-muted)]",
  },
  success: {
    shell: "border-[var(--cs-success)]/20",
    dot: "bg-[var(--cs-success)]",
  },
  warning: {
    shell: "border-amber-200",
    dot: "bg-amber-500",
  },
  info: {
    shell: "border-blue-200",
    dot: "bg-blue-500",
  },
};

export function CashFlowMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  const styles = METRIC_TONE[tone];

  return (
    <div
      className={`cs-metric min-w-0 rounded-[var(--cs-r-lg)] border bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)] ${styles.shell}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
          {label}
        </p>

        <span className={`size-2 shrink-0 rounded-full ${styles.dot}`} />
      </div>

      <p className="mt-2 truncate text-2xl font-bold tabular-nums tracking-tight text-[var(--cs-text)]">
        {value}
      </p>

      {detail ? (
        <p className="mt-1.5 text-xs leading-5 text-[var(--cs-text-muted)]">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function CashFlowPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceSection title={title} description={description}>
      <div className="p-4 sm:p-5">{children}</div>
    </WorkspaceSection>
  );
}