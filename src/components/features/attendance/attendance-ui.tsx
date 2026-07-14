import { ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { formatMinutesCompact } from "@/lib/attendance/time";
import { cn } from "@/lib/utils";

type AttendanceTone = "good" | "warn" | "bad" | "neutral";
type NoticeTone = "success" | "warning" | "error" | "info";

export function formatAttendanceDateTime(value: string | null | undefined, timezone = "Asia/Manila"): string {
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
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CH";
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
    <section className={cn("cs-card grid gap-3 rounded-lg p-4", className)}>
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

export function EmptyState({
  title,
  detail,
  icon,
  action,
  className,
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span> : null}
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{title}</div>
          {detail ? <div className="mt-1">{detail}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ContextChip({
  icon,
  children,
  ariaLabel,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground",
        className
      )}
    >
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export function WorkspaceNotice({
  tone,
  title,
  children,
  className,
}: {
  tone: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const role = tone === "error" || tone === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "success" && "border-emerald-800/20 bg-emerald-50 text-emerald-900",
        tone === "warning" && "border-amber-700/25 bg-[#FFF7E8] text-amber-950",
        tone === "error" && "border-red-700/20 bg-red-50 text-red-800",
        tone === "info" && "border-border bg-muted/40 text-foreground",
        className
      )}
    >
      {title ? <div className="font-bold">{title}</div> : null}
      <div className={cn(title && "mt-1")}>{children}</div>
    </div>
  );
}

export function WorkspaceSection({
  title,
  description,
  context,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}>
      <WorkspaceSectionHeader
        title={title}
        description={description}
        context={context}
        actions={actions}
      />
      {children}
    </section>
  );
}

export function WorkspaceSectionHeader({
  title,
  description,
  context,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-5",
        className
      )}
    >
      <div>
        <h2 className="m-0 text-xl font-bold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {context || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {context}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function ToolbarShell({
  children,
  actions,
  className,
  fieldsClassName,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  fieldsClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm 2xl:flex-row 2xl:items-end 2xl:justify-between",
        className
      )}
    >
      <div className={cn("grid min-w-0 flex-1 gap-3", fieldsClassName)}>{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2 2xl:justify-end">{actions}</div> : null}
    </div>
  );
}

export function ToolbarSelect({
  label,
  value,
  onChange,
  children,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1", className)}>
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-0 appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:border-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

export function ToolbarSearch({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1", className)}>
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 shadow-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </span>
    </label>
  );
}

export function AttendanceTabPanel({
  id,
  labelledBy,
  active,
  children,
}: {
  id: string;
  labelledBy: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={0}
      hidden={!active}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </section>
  );
}

export function StatusPill({ value, tone }: { value: string; tone?: AttendanceTone }) {
  const inferredTone =
    tone ??
    (["success", "active", "checked_in", "available", "in_service", "present", "resolved", "completed", "session_started"].includes(value)
      ? "good"
      : ["open", "late", "early_leave", "overtime", "blocked", "warning", "ending_soon"].includes(value)
        ? "warn"
        : ["revoked", "error", "overdue", "conflict", "rejected"].includes(value)
          ? "bad"
          : "neutral");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        inferredTone === "good" && "bg-emerald-100 text-emerald-800",
        inferredTone === "warn" && "bg-amber-100 text-amber-800",
        inferredTone === "bad" && "bg-red-100 text-red-700",
        inferredTone === "neutral" && "bg-slate-100 text-muted-foreground"
      )}
    >
      {humanizeAttendanceValue(value)}
    </span>
  );
}

export function StaffAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-white">
      {getInitials(name)}
    </span>
  );
}

export function RemainingProgress({ remainingMinutes, totalMinutes }: { remainingMinutes: number; totalMinutes: number }) {
  const percent = totalMinutes > 0 ? Math.max(0, Math.min(100, (remainingMinutes / totalMinutes) * 100)) : 0;
  return (
    <div className="grid min-w-24 gap-1">
      <span className="text-xs font-semibold">{formatMinutesCompact(Math.max(0, remainingMinutes))}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-emerald-950/10">
        <span className="block h-full rounded-full bg-emerald-700" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

export { formatMinutesCompact };
