import { AlertTriangle, CalendarClock, CalendarOff, Coffee, UserCheck, Users } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { DailyTimelineAlert } from "./daily-timeline-alerts";
import { getShiftGroup, getTimelineStatus } from "./daily-timeline-operations";

type Props = {
  rows: DailyScheduleStaffRow[];
  date: string;
  now: Date | null;
  groupLabel: string;
  alerts: DailyTimelineAlert[];
};

export function DailyTimelineSummary({ rows, date, now, groupLabel, alerts }: Props) {
  const scheduled = rows.filter((row) => getShiftGroup(row) !== "off").length;
  const available = rows.filter((row) => getTimelineStatus(row, date, now) === "available").length;
  const busy = rows.filter((row) => getTimelineStatus(row, date, now) === "busy").length;
  const off = rows.length - scheduled;
  const blocked = rows.filter((row) => row.blocks.length > 0).length;
  const conflicts = alerts.filter(
    (alert) => alert.type === "resource_conflict" || alert.type === "staff_conflict"
  ).length;
  const metrics = [
    { label: "Total Staff", value: rows.length, icon: Users, color: "text-stone-700" },
    { label: "Scheduled", value: scheduled, icon: UserCheck, color: "text-emerald-700" },
    { label: "Available Now", value: available, icon: UserCheck, color: "text-emerald-700" },
    { label: "Busy Now", value: busy, icon: Coffee, color: "text-amber-700" },
    { label: "Off Today", value: off, icon: CalendarOff, color: "text-stone-600" },
    { label: "Blocked", value: blocked, icon: CalendarClock, color: "text-orange-700" },
    { label: "Conflicts", value: conflicts, icon: AlertTriangle, color: "text-red-600" },
  ];
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--cs-border)] bg-white shadow-sm sm:grid-cols-4 lg:grid-cols-[190px_repeat(7,minmax(82px,1fr))]">
      <div className="col-span-2 border-b border-[var(--cs-border-soft)] px-4 py-3 sm:col-span-4 lg:col-span-1 lg:border-b-0 lg:border-r">
        <p className="text-[10px] font-bold text-[var(--cs-text)]">Today&apos;s Summary · {groupLabel}</p>
        <p className="mt-1 text-[9px] text-[var(--cs-text-muted)]">{dateLabel}</p>
      </div>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="flex min-h-16 items-center gap-2 border-b border-r border-[var(--cs-border-soft)] px-3 py-2 lg:border-b-0">
            <Icon className={`size-3.5 shrink-0 ${metric.color}`} />
            <div>
              <p className="text-[9px] text-[var(--cs-text-muted)]">{metric.label}</p>
              <p className={`text-base font-bold tabular-nums ${metric.color}`}>{metric.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
