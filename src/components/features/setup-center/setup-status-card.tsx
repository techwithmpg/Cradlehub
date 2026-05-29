import Link from "next/link";
import { cn } from "@/lib/utils";

export type SetupStatus = "ready" | "warning" | "error" | "info";

const statusConfig: Record<SetupStatus, { dot: string; accent: string; bg: string; valueColor: string }> = {
  ready: {
    dot: "bg-[#5A8A6A]",
    accent: "border-l-[#5A8A6A]",
    bg: "bg-[#f6f9f7]",
    valueColor: "text-[#5A8A6A]",
  },
  warning: {
    dot: "bg-[#A67B5B]",
    accent: "border-l-[#A67B5B]",
    bg: "bg-[#fdfbf8]",
    valueColor: "text-[#A67B5B]",
  },
  error: {
    dot: "bg-[#c0392b]",
    accent: "border-l-[#c0392b]",
    bg: "bg-[#fdf6f5]",
    valueColor: "text-[#c0392b]",
  },
  info: {
    dot: "bg-[var(--cs-text-muted)]",
    accent: "border-l-[var(--cs-text-muted)]",
    bg: "bg-[var(--cs-surface)]",
    valueColor: "text-[var(--cs-text-secondary)]",
  },
};

export function SetupStatusCard({
  icon,
  label,
  value,
  sub,
  status,
  actionLabel,
  actionHref,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  status: SetupStatus;
  actionLabel?: string;
  actionHref?: string;
}) {
  const cfg = statusConfig[status];

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm transition-all hover:shadow-md border-l-[3px]",
        cfg.accent
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--cs-surface-warm)] text-sm">
          {icon}
        </span>
        <span className="flex-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
          {label}
        </span>
        <span className={cn("inline-block h-2 w-2 rounded-full", cfg.dot)} />
      </div>
      <div className={cn("mt-2 text-2xl font-bold leading-none", cfg.valueColor)}>
        {value}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-muted)]">
        {sub}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--cs-sand)] transition-all hover:border-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)]"
        >
          {actionLabel} ›
        </Link>
      )}
    </div>
  );
}
