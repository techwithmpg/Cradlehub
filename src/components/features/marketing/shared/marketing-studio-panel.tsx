"use client";

import React from "react";

export type MarketingStudioPanelProps = {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function MarketingStudioPanel({
  title,
  description,
  badge,
  headerAction,
  children,
  className = "",
}: MarketingStudioPanelProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-xs ${className}`}
    >
      {(title || description || badge || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border)] pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              {title && <h2 className="text-base font-bold text-[var(--cs-text)]">{title}</h2>}
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">{description}</p>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
