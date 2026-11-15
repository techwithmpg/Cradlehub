import { ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoticeTone = "success" | "warning" | "error" | "info";

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
        "rounded-2xl border border-dashed border-[var(--cs-border)] bg-[#FAF8F5] p-6 text-sm text-[var(--cs-text-muted)]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]">{icon}</span> : null}
        <div className="min-w-0">
          <div className="font-semibold text-[var(--cs-text)]">{title}</div>
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
        "inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--cs-text-secondary)] shadow-2xs",
        className
      )}
    >
      {icon ? <span className="shrink-0 text-[var(--cs-text-muted)]">{icon}</span> : null}
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
        "rounded-xl border px-4 py-3 text-sm",
        tone === "success" && "border-[#CFE5D6] bg-[#EEF7F1] text-[#1F4E33]",
        tone === "warning" && "border-amber-200 bg-amber-50/80 text-amber-950",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-900",
        tone === "info" && "border-[var(--cs-border)] bg-[#FAF8F5] text-[var(--cs-text)]",
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
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs",
        className
      )}
    >
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
        "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cs-border-soft)] px-5 py-4",
        className
      )}
    >
      <div>
        <h2 className="m-0 text-base font-bold tracking-tight text-[var(--cs-text)] sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--cs-text-muted)] sm:text-sm">{description}</p>
        ) : null}
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
        "flex flex-col gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-white p-3.5 shadow-2xs 2xl:flex-row 2xl:items-end 2xl:justify-between",
        className
      )}
    >
      <div className={cn("grid min-w-0 flex-1 gap-3", fieldsClassName)}>{children}</div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 2xl:justify-end">{actions}</div>
      ) : null}
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
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </span>
      <span className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full min-w-0 appearance-none rounded-lg border border-[var(--cs-border)] bg-white px-3 pr-9 text-xs font-semibold text-[var(--cs-text)] outline-none transition focus:border-[#1F4E33] disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
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
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </span>
      <span className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-white px-3 transition-within focus-within:border-[#1F4E33]">
        <Search className="size-4 shrink-0 text-[var(--cs-text-muted)]" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--cs-text)] outline-none sm:text-sm"
        />
      </span>
    </label>
  );
}

export function CrmTabPanel({
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
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]"
    >
      {children}
    </section>
  );
}
