"use client";

import Link from "next/link";
import type { ComponentType, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type CrmModuleTabItem<T extends string = string> = {
  key: T;
  label: string;
  count?: number;
  icon?: ComponentType<{ className?: string }>;
  href?: string;
  id?: string;
  controls?: string;
  ariaLabel?: string;
};

/**
 * Canonical primary CRM underline tab navigation (inspired by CrmAttendanceNavigation).
 * Supports both client state callbacks and Next.js Link hrefs, plus full arrow/Home/End keyboard nav.
 */
export function CrmModuleTabs<T extends string>({
  tabs,
  activeKey,
  onChange,
  ariaLabel = "Workspace sections",
  className,
}: {
  tabs: CrmModuleTabItem<T>[];
  activeKey: T;
  onChange?: (key: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    if (tabs.length === 0) return;
    event.preventDefault();
    const current = Math.max(
      0,
      tabs.findIndex((item) => item.key === activeKey)
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length;
    const nextItem = tabs[next];
    if (nextItem && onChange && !nextItem.href) {
      onChange(nextItem.key);
    }
    const container = event.currentTarget;
    window.setTimeout(() => {
      const target = container.querySelectorAll<HTMLElement>("[role=tab], a[data-crm-tab]")[next];
      target?.focus();
    });
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "flex overflow-x-auto rounded-t-xl border-b border-[var(--cs-border-soft)] bg-white px-2 sm:px-4 scrollbar-hide",
        className
      )}
    >
      {tabs.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        const inner = (
          <>
            {Icon ? <Icon className="size-4 shrink-0" /> : null}
            <span>{item.label}</span>
            {typeof item.count === "number" && item.count > 0 ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums",
                  active
                    ? "bg-[#EFE2BE] text-[#6E531A]"
                    : "bg-[#F3EFE8] text-[var(--cs-text-secondary)]"
                )}
              >
                {item.count}
              </span>
            ) : null}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-t-full bg-[#1F4E33]"
              />
            ) : null}
          </>
        );

        const sharedClass = cn(
          "relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
          active
            ? "text-[#1F4E33]"
            : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
        );

        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              data-crm-tab="true"
              aria-current={active ? "page" : undefined}
              aria-label={item.ariaLabel ?? item.label}
              onClick={() => onChange?.(item.key)}
              className={sharedClass}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={item.id}
            aria-controls={item.controls}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={item.ariaLabel ?? item.label}
            onClick={() => onChange?.(item.key)}
            className={sharedClass}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Canonical secondary CRM pill switcher (matching Attendance Setup sub-tabs).
 */
export function CrmSubTabs<T extends string>({
  tabs,
  activeKey,
  onChange,
  ariaLabel = "Sub-sections",
  className,
}: {
  tabs: CrmModuleTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--cs-border-soft)] bg-white p-1 shadow-2xs",
        className
      )}
    >
      {tabs.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={item.id}
            aria-controls={item.controls}
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
              active
                ? "bg-[#1F4E33] text-white shadow-2xs"
                : "text-[var(--cs-text-secondary)] hover:bg-[#FAF8F5] hover:text-[var(--cs-text)]"
            )}
          >
            {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
            <span>{item.label}</span>
            {typeof item.count === "number" && item.count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-[#F3EFE8] text-[var(--cs-text-muted)]"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
