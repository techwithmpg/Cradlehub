import { CalendarCheck2, Layers3, Wrench } from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import {
  ATTENDANCE_VIEWS,
  attendanceViewPanelId,
  attendanceViewTabId,
  type AttendanceView,
} from "@/lib/attendance/workspace-navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<AttendanceView, ComponentType<{ className?: string }>> = {
  today: CalendarCheck2,
  "fix-scan": Wrench,
  tools: Layers3,
};

export function AttendancePrimaryTabs({
  activeView,
  onViewChange,
}: {
  activeView: AttendanceView;
  onViewChange: (view: AttendanceView) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tablist = event.currentTarget;
    const current = ATTENDANCE_VIEWS.findIndex((item) => item.key === activeView);
    const last = ATTENDANCE_VIEWS.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowRight"
            ? (current + 1) % ATTENDANCE_VIEWS.length
            : (current - 1 + ATTENDANCE_VIEWS.length) % ATTENDANCE_VIEWS.length;
    onViewChange(ATTENDANCE_VIEWS[next]?.key ?? "today");
    window.setTimeout(() => {
      tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }, 0);
  }

  return (
    <div
      role="tablist"
      aria-label="Attendance areas"
      onKeyDown={handleKeyDown}
      className="grid overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-sm sm:grid-cols-3"
    >
      {ATTENDANCE_VIEWS.map((item, index) => {
        const active = item.key === activeView;
        const Icon = ICONS[item.key];
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={attendanceViewTabId(item.key)}
            aria-controls={attendanceViewPanelId(item.key)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onViewChange(item.key)}
            className={cn(
              "flex min-h-14 items-center justify-center gap-2 border-b border-[var(--cs-border)] px-4 text-sm font-bold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-forest)] sm:border-b-0",
              index > 0 && "sm:border-l",
              active
                ? "bg-[var(--sp-forest)] text-white"
                : "bg-white text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)] hover:text-[var(--sp-forest)]"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
