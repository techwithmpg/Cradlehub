"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffBottomNavProps, StaffNavItem } from "./types";
import { cn } from "@/lib/utils";

export function StaffBottomNav({
  items,
  activeKey,
  onScanClick,
  ariaLabel = "Staff navigation",
}: StaffBottomNavProps) {
  const pathname = usePathname();

  function isItemActive(item: StaffNavItem): boolean {
    if (activeKey) return activeKey === item.key;

    const rootPaths = [
      "/staff",
      "/staff-portal",
      "/staff/driver",
      "/driver",
      "/staff/utility",
      "/utility",
    ];

    if (rootPaths.includes(item.href)) {
      return pathname === item.href || pathname === `${item.href}/`;
    }

    return pathname.startsWith(item.href);
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E8E1D7] bg-white/95 shadow-[0_-8px_24px_rgba(22,58,43,0.04)] backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid h-[72px] max-w-md grid-cols-5 items-center px-2">
        {items.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;

          if (item.isScan) {
            const scanContent = (
              <span className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#0D5C43] text-white shadow-[0_10px_26px_rgba(13,92,67,0.30)] ring-4 ring-[#F7F3EB] transition-transform duration-150 active:scale-95">
                <Icon
                  size={24}
                  className="text-white"
                  aria-hidden="true"
                />
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                  {item.label}
                </span>
              </span>
            );

            if (onScanClick) {
              return (
                <div key={item.key} className="flex h-full items-center justify-center">
                  <button
                    type="button"
                    onClick={onScanClick}
                    aria-label="Scan QR code"
                    className="flex h-16 w-16 -translate-y-2 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]"
                  >
                    {scanContent}
                  </button>
                </div>
              );
            }

            return (
              <div key={item.key} className="flex h-full items-center justify-center">
                <a
                  href={item.href}
                  aria-label="Scan QR code"
                  aria-current={active ? "page" : undefined}
                  className="flex h-16 w-16 -translate-y-2 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]"
                >
                  {scanContent}
                </a>
              </div>
            );
          }

          if (item.disabled) {
            return (
              <div
                key={item.key}
                title={item.blockedNotice ?? `${item.label} is unavailable`}
                className="flex h-full flex-col items-center justify-center opacity-40 select-none"
                aria-disabled="true"
              >
                <div className="flex h-7 w-7 items-center justify-center">
                  <Icon size={20} className="text-[#718096]" aria-hidden="true" />
                </div>
                <span className="mt-1 text-[10.5px] font-medium leading-none text-[#718096]">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full flex-col items-center justify-center rounded-xl pb-1 pt-2 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]",
                active
                  ? "text-[#0D5C43]"
                  : "text-[#61728A] hover:text-[#1E293B]"
              )}
            >
              <div className="flex h-7 w-7 items-center justify-center">
                <Icon
                  size={21}
                  className={cn(active && "scale-105")}
                  aria-hidden="true"
                />
              </div>

              <span
                className={cn(
                  "mt-1 text-[10.5px] leading-none",
                  active
                    ? "font-bold text-[#0D5C43]"
                    : "font-medium text-[#61728A]"
                )}
              >
                {item.label}
              </span>

              {active ? (
                <span
                  className="absolute bottom-1 h-[3px] w-6 rounded-full bg-[#0D5C43]"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}