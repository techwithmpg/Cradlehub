import type { ReactNode } from "react";
import { formatMinutesCompact } from "@/lib/attendance/time";
import { cn } from "@/lib/utils";

type AttendanceTone = "good" | "warn" | "bad" | "neutral";

export {
  ContextChip,
  CrmTabPanel as AttendanceTabPanel,
  EmptyState,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
  WorkspaceNotice,
  WorkspaceSection,
  WorkspaceSectionHeader,
} from "@/components/features/crm/shared/crm-workspace-primitives";

export function formatAttendanceDateTime(
  value: string | null | undefined,
  timezone = "Asia/Manila"
): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatAttendanceDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function humanizeAttendanceValue(value: string): string {
  return value.replaceAll("_", " ");
}

export function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CH"
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cs-card grid gap-3 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.98rem] font-bold text-foreground">{title}</h2>
          {description ? (
            <p className="m-0 mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ value, tone }: { value: string; tone?: AttendanceTone }) {
  const inferredTone =
    tone ??
    ([
      "success",
      "active",
      "checked_in",
      "available",
      "in_service",
      "present",
      "resolved",
      "completed",
      "session_started",
    ].includes(value)
      ? "good"
      : ["open", "late", "early_leave", "overtime", "blocked", "warning", "ending_soon"].includes(
            value
          )
        ? "warn"
        : ["revoked", "error", "overdue", "conflict", "rejected"].includes(value)
          ? "bad"
          : "neutral");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        inferredTone === "good" && "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
        inferredTone === "warn" && "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
        inferredTone === "bad" && "bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]",
        inferredTone === "neutral" && "bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]"
      )}
    >
      {humanizeAttendanceValue(value)}
    </span>
  );
}

export function StaffAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-crm-accent)] text-xs font-bold text-white",
        className
      )}
    >
      {getInitials(name)}
    </span>
  );
}

export function RemainingProgress({
  remainingMinutes,
  totalMinutes,
}: {
  remainingMinutes: number;
  totalMinutes: number;
}) {
  const percent =
    totalMinutes > 0 ? Math.max(0, Math.min(100, (remainingMinutes / totalMinutes) * 100)) : 0;
  return (
    <div className="grid min-w-24 gap-1">
      <span className="text-xs font-semibold">
        {formatMinutesCompact(Math.max(0, remainingMinutes))}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[var(--cs-neutral-bg)]">
        <span
          className="block h-full rounded-full bg-[var(--cs-crm-accent)]"
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}

export { formatMinutesCompact };
