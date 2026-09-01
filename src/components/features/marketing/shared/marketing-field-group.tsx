"use client";

import React from "react";

export type MarketingFieldGroupProps = {
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function MarketingFieldGroup({
  title,
  description,
  badge,
  children,
  className = "",
}: MarketingFieldGroupProps) {
  return (
    <div
      className={`space-y-3.5 rounded-xl border border-[var(--cs-border-subtle)] bg-[var(--cs-surface-warm)] p-4.5 ${className}`}
    >
      {(title || description || badge) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cs-border-subtle)] pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              {title && (
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#9A7B38] dark:text-[#C8A96B]">
                  {title}
                </label>
              )}
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-[11px] text-[var(--cs-text-secondary)]">{description}</p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
