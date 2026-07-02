import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  QrCode,
  Smartphone,
  Timer,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import { ATTENDANCE_TABS, type AttendanceTab } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<AttendanceTab, ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  records: ClipboardList,
  sessions: Timer,
  qr: QrCode,
  devices: Smartphone,
  exceptions: TriangleAlert,
  reports: ChartNoAxesCombined,
};

export function AttendanceTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: AttendanceTab;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
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
      const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabs[nextIndex]?.focus();
    }, 0);
  }

  return (
    <div
      role="tablist"
      aria-label="Attendance sections"
      className="flex gap-1 overflow-x-auto border-b border-border pb-0"
      onKeyDown={handleKeyDown}
    >
      {ATTENDANCE_TABS.map((tab) => {
        const active = tab.key === activeTab;
        const Icon = TAB_ICONS[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-emerald-800 text-emerald-900"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
