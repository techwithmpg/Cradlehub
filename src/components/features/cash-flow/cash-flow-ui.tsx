import type { ReactNode } from "react";
import { WorkspaceSection } from "@/components/features/attendance/attendance-ui";
export const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)]";
export function CashFlowStatus({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-1 text-xs font-semibold capitalize text-[var(--cs-text)]">
      {children}
    </span>
  );
}
export function CashFlowMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--cs-text)]">{value}</p>
      {detail && <p className="mt-1 text-xs text-[var(--cs-text-muted)]">{detail}</p>}
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
      <div className="p-4">{children}</div>
    </WorkspaceSection>
  );
}
