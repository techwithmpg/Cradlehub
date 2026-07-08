import type { ReactNode } from "react";
import { formatMinutesCompact } from "@/lib/attendance/time";
import { cn } from "@/lib/utils";

export function formatAttendanceDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
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
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cs-card grid gap-3 rounded-lg p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[0.98rem] font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <div className="font-semibold text-foreground">{title}</div>
      {detail ? <div className="mt-1">{detail}</div> : null}
    </div>
  );
}

export function StatusPill({ value, tone }: { value: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
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
