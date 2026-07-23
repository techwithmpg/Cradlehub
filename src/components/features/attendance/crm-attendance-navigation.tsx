"use client";

import { CalendarDays, ClipboardCheck, History, Settings2 } from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import {
  CRM_ATTENDANCE_VIEWS,
  crmAttendancePanelId,
  crmAttendanceTabId,
  type CrmAttendanceView,
} from "@/lib/attendance/crm-navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<CrmAttendanceView, ComponentType<{ className?: string }>> = {
  today: CalendarDays,
  review: ClipboardCheck,
  history: History,
  setup: Settings2,
};

export function CrmAttendanceNavigation({
  activeView,
  reviewCount,
  onChange,
}: {
  activeView: CrmAttendanceView;
  reviewCount: number;
  onChange: (view: CrmAttendanceView) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = CRM_ATTENDANCE_VIEWS.findIndex((item) => item.key === activeView);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 3
          : event.key === "ArrowRight"
            ? (current + 1) % 4
            : (current + 3) % 4;
    const tablist = event.currentTarget;
    onChange(CRM_ATTENDANCE_VIEWS[next]?.key ?? "today");
    window.setTimeout(() =>
      tablist.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus()
    );
  }
  return (
    <div
      role="tablist"
      aria-label="Attendance workspaces"
      onKeyDown={onKeyDown}
      className="flex overflow-x-auto border-b border-[var(--cs-border-soft)] px-2 sm:px-4"
    >
      {CRM_ATTENDANCE_VIEWS.map((item) => {
        const active = activeView === item.key;
        const Icon = ICONS[item.key];
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={crmAttendanceTabId(item.key)}
            aria-controls={crmAttendancePanelId(item.key)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={
              item.key === "review" && reviewCount > 0 ? `Review, ${reviewCount} open` : item.label
            }
            onClick={() => onChange(item.key)}
            className={cn(
              "relative inline-flex min-h-12 shrink-0 items-center gap-2 px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#2A5A3A]",
              active ? "text-[#2A5A3A]" : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
            )}
          >
            <Icon className="size-4" />
            {item.label}
            {item.key === "review" && reviewCount > 0 ? (
              <span className="rounded-full bg-[#E8D5A3] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#2A5A3A]">
                {reviewCount}
              </span>
            ) : null}
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#2A5A3A]" /> : null}
          </button>
        );
      })}
    </div>
  );
}
