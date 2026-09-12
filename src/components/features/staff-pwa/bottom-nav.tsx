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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#EAE4DC] bg-[#FFFFFF]/95 backdrop-blur-md"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {items.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;

          if (item.isScan) {
            // Central prominent Scan action (56px touch target in its own cell)
            const scanContent = (
              <span className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-[#163A2B] text-white shadow-md transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]">
                <Icon size={22} className="text-[#C8A96B]" aria-hidden="true" />
                <span className="mt-0.5 text-[10px] font-bold tracking-wide uppercase text-white">
                  {item.label}
                </span>
              </span>
            );

            if (onScanClick) {
              return (
                <div key={item.key} className="flex justify-center">
                  <button
                    type="button"
                    onClick={onScanClick}
                    aria-label="Scan QR code"
                    className="flex h-14 w-14 items-center justify-center focus:outline-none"
                  >
                    {scanContent}
                  </button>
                </div>
              );
            }

            return (
              <div key={item.key} className="flex justify-center">
                {/* Force same-origin document navigation so /staff/scan loads its narrow Permissions-Policy (camera=(self)) */}
                <a
                  href={item.href}
                  aria-label="Scan QR code"
                  aria-current={active ? "page" : undefined}
                  className="flex h-14 w-14 items-center justify-center focus:outline-none"
                >
                  {scanContent}
                </a>
              </div>
            );
          }

          if (item.disabled) {
            // Disabled / Blocked destination (e.g., Utility Work)
            return (
              <div
                key={item.key}
                title={item.blockedNotice ?? `${item.label} is unavailable`}
                className="flex flex-col items-center justify-center py-1 opacity-40 select-none"
                aria-disabled="true"
              >
                <div className="flex h-7 w-7 items-center justify-center">
                  <Icon size={20} className="text-[#64748B]" aria-hidden="true" />
                </div>
                <span className="mt-1 text-[11px] font-medium leading-none text-[#64748B]">
                  {item.label}
                </span>
              </div>
            );
          }

          // Standard Navigation destination (min 48px touch target)
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-full flex-col items-center justify-center py-1 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B] rounded-lg",
                active ? "text-[#163A2B]" : "text-[#64748B] hover:text-[#1E293B]"
              )}
            >
              <div className="relative flex h-7 w-7 items-center justify-center">
                <Icon
                  size={20}
                  className={cn(
                    "transition-transform",
                    active && "scale-110 stroke-[2.25]"
                  )}
                  aria-hidden="true"
                />
                {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-[#9B1C20] px-0.5 text-[9px] font-bold leading-none text-white">
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  "mt-1 text-[11px] leading-none transition-colors",
                  active ? "font-bold text-[#163A2B]" : "font-medium text-[#64748B]"
                )}
              >
                {item.label}
              </span>
              {active ? (
                <span
                  className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[#163A2B]"
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
