import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardPanel({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#efe7d7] text-[#0b3b27]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-base font-semibold text-[var(--cs-text)]">
          {title}
        </h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-5 text-sm text-[var(--cs-warning-text)]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">This section could not load.</p>
        <p className="mt-1 text-[var(--cs-text-muted)]">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#f4efe5] text-[#b78a42]">
        <span className="size-7 rounded-md border border-current opacity-60" />
      </div>
      <p className="font-heading text-base font-semibold text-[var(--cs-text)]">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-sm text-[var(--cs-text-muted)]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function NativeSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="not-sr-only h-8 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-medium text-[var(--cs-text)] shadow-sm outline-none transition focus:border-[#b78a42] focus:ring-2 focus:ring-[#b78a42]/20"
      >
        {children}
      </select>
    </label>
  );
}
