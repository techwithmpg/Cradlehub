"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type FloatingMobileNavItem = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
  badgeCount?: number;
};

export type FloatingMobileCenterAction = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
};

export type FloatingMobileBottomNavProps = {
  items: FloatingMobileNavItem[];
  centerAction?: FloatingMobileCenterAction;
  variant?: "light" | "dark";
  ariaLabel?: string;
};

type NavButtonContentProps = {
  item: FloatingMobileNavItem;
  activeClassName: string;
  inactiveClassName: string;
};

function NavButtonContent({
  item,
  activeClassName,
  inactiveClassName,
}: NavButtonContentProps) {
  const Icon = item.icon;

  return (
    <>
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Icon className="h-6 w-6" />
        {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {item.badgeCount > 99 ? "99+" : item.badgeCount}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-1 max-w-[56px] truncate text-[11px] leading-none",
          item.active ? activeClassName : inactiveClassName
        )}
      >
        {item.label}
      </span>
    </>
  );
}

function CenterActionButton({
  action,
}: {
  action: FloatingMobileCenterAction;
}) {
  const Icon = action.icon;
  const className = cn(
    "mx-auto flex h-[62px] w-[62px] -translate-y-5 items-center justify-center rounded-full bg-teal-500 text-white shadow-xl transition active:scale-95 disabled:opacity-60",
    action.active && "ring-4 ring-emerald-100"
  );

  const content = (
    <>
      <Icon className="h-8 w-8" />
      <span className="sr-only">{action.label}</span>
    </>
  );

  if (action.href) {
    return (
      <Link
        href={action.href}
        aria-label={action.label}
        aria-current={action.active ? "page" : undefined}
        className={cn(className, action.disabled && "pointer-events-none opacity-60")}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-label={action.label}
      aria-current={action.active ? "page" : undefined}
      className={className}
    >
      {content}
    </button>
  );
}

export function FloatingMobileBottomNav({
  items,
  centerAction,
  variant = "light",
  ariaLabel = "Mobile navigation",
}: FloatingMobileBottomNavProps) {
  const visibleItems = items.slice(0, 4);
  const leftItems = visibleItems.slice(0, 2);
  const rightItems = visibleItems.slice(2, 4);
  const activeClassName = variant === "dark" ? "text-teal-300 font-semibold" : "text-teal-600 font-semibold";
  const inactiveClassName = variant === "dark" ? "text-slate-300" : "text-slate-500";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label={ariaLabel}
        className={cn(
          "pointer-events-auto mx-auto grid min-h-[78px] max-w-[430px] grid-cols-5 items-center rounded-[2rem] border px-3 py-2 shadow-2xl backdrop-blur-xl",
          variant === "dark"
            ? "border-white/10 bg-slate-950/[0.82] text-slate-300 shadow-black/[0.30]"
            : "border-white/70 bg-white/[0.88] text-slate-500 shadow-black/[0.15]"
        )}
      >
        {leftItems.map((item) => (
          <NavControl
            key={`${item.href ?? item.label}-left`}
            item={item}
            activeClassName={activeClassName}
            inactiveClassName={inactiveClassName}
          />
        ))}

        <div className="flex min-w-0 items-center justify-center">
          {centerAction ? <CenterActionButton action={centerAction} /> : null}
        </div>

        {rightItems.map((item) => (
          <NavControl
            key={`${item.href ?? item.label}-right`}
            item={item}
            activeClassName={activeClassName}
            inactiveClassName={inactiveClassName}
          />
        ))}
      </nav>
    </div>
  );
}

function NavControl({
  item,
  activeClassName,
  inactiveClassName,
}: NavButtonContentProps) {
  const className = cn(
    "relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-2xl px-1 text-center transition active:scale-95",
    item.active ? activeClassName : inactiveClassName
  );
  const content = (
    <NavButtonContent
      item={item}
      activeClassName={activeClassName}
      inactiveClassName={inactiveClassName}
    />
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-current={item.active ? "page" : undefined}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-current={item.active ? "page" : undefined}
      className={className}
    >
      {content}
    </button>
  );
}
