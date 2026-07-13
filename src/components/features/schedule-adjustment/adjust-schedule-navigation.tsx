"use client";

import { Calendar, CalendarRange, Clock3, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdjustScheduleMode } from "./adjust-schedule-types";

type AdjustScheduleNavigationProps = {
  mode: AdjustScheduleMode;
  onModeChange: (mode: AdjustScheduleMode) => void;
};

const NAV_ITEMS: Array<{
  mode: AdjustScheduleMode;
  label: string;
  subtitle: string;
  icon: typeof Calendar;
}> = [
  { mode: "weekly", label: "Weekly Schedule", subtitle: "Regular weekly pattern", icon: Calendar },
  { mode: "date", label: "Specific Date / Range", subtitle: "One-off or date range", icon: CalendarRange },
  { mode: "blocked", label: "Unavailable Time", subtitle: "Block time within working hours", icon: Clock3 },
  { mode: "exceptions", label: "Approved Exceptions", subtitle: "Special cases and approvals", icon: ShieldCheck },
];

export function AdjustScheduleNavigation({ mode, onModeChange }: AdjustScheduleNavigationProps) {
  return (
    <nav
      aria-label="Adjustment type"
      className="overflow-hidden rounded-lg border border-[#e3dccf] bg-white"
    >
      <div className="border-b border-[#ece5d8] px-4 py-3 text-[0.68rem] font-bold uppercase text-[#615c52]">
        Adjustment Type
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:block">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.mode === mode;
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => onModeChange(item.mode)}
              className={cn(
                "flex min-h-16 w-full items-start gap-3 border-b border-[#eee8dc] px-4 py-3 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6b43]/30 sm:border-b-0 sm:border-r xl:border-r-0 xl:border-b",
                active
                  ? "border-l-4 border-l-[#0f6b43] bg-[#eef7f1] text-[#103f2b]"
                  : "border-l-4 border-l-transparent bg-white text-[#28251f] hover:bg-[#faf7ef]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-[#0f6b43]" : "text-[#615c52]")} />
              <span className="min-w-0">
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block leading-4 text-[#615c52]">{item.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
