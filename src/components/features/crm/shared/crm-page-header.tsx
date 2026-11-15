import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CrmPageHeaderProps = {
  /** Small uppercase line above the title (e.g. branch name, date, or context). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional inline badge(s) next to the title or below it. */
  badge?: ReactNode;
  /** Right-aligned action buttons / controls. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Canonical borderless typography header for CRM workspaces, aligned with the
 * approved Attendance design standard (sand eyebrow, crisp 26px display title,
 * muted subtitle, right-aligned controls).
 */
export function CrmPageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: CrmPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-sand-dark)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-text)] sm:text-[1.65rem]">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-xs font-medium text-[var(--cs-text-muted)] sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </header>
  );
}
