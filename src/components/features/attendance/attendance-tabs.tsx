import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  QrCode,
  Smartphone,
  Timer,
  Wrench,
} from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import { attendanceTabId, attendanceTabPanelId } from "@/lib/attendance/tabs";
import { ATTENDANCE_TABS, type AttendanceTab } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<AttendanceTab, ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  exceptions: Wrench,
  records: ClipboardList,
  sessions: Timer,
  qr: QrCode,
  devices: Smartphone,
  reports: ChartNoAxesCombined,
};

export function AttendanceTabs({
  activeTab,
  reviewCount,
  onTabChange,
}: {
  activeTab: AttendanceTab;
  reviewCount: number;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tablist = event.currentTarget;
    const index = ATTENDANCE_TABS.findIndex((tab) => tab.key === activeTab);
    const lastIndex = ATTENDANCE_TABS.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % ATTENDANCE_TABS.length
            : (index - 1 + ATTENDANCE_TABS.length) % ATTENDANCE_TABS.length;

    const nextTab = ATTENDANCE_TABS[nextIndex]?.key ?? "overview";
    onTabChange(nextTab);
    window.setTimeout(() => {
      const tabs = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabs[nextIndex]?.focus();
    }, 0);
  }

  return (
    <div
      role="tablist"
      aria-label="Attendance sections"
      className="flex min-w-0 gap-1 overflow-x-auto px-3 sm:px-4"
      onKeyDown={handleKeyDown}
    >
      {ATTENDANCE_TABS.map((tab) => {
        const active = tab.key === activeTab;
        const Icon = TAB_ICONS[tab.key];
        const badge = tab.key === "exceptions" ? reviewCount : 0;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={attendanceTabId(tab.key)}
            aria-controls={attendanceTabPanelId(tab.key)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
              active
                ? "border-[var(--cs-crm-accent)] text-[var(--cs-crm-text)]"
                : "border-transparent text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {tab.label}
            {badge > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--cs-error-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cs-error-text)]">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
