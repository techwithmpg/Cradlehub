"use client";

import { cn } from "@/lib/utils";

export type AdminOverlayHeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function AdminOverlayHeader({
  title,
  description,
  children,
  className,
}: AdminOverlayHeaderProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-[var(--cs-border)] px-5 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--cs-text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[0.8125rem] text-[var(--cs-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
