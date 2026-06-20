import { ChevronRight, Users } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { formatScheduleTime, isToday } from "@/lib/utils/schedule-timeline";
import { getTimelineStatus } from "./daily-timeline-operations";

type Props = {
  rows: DailyScheduleStaffRow[];
  date: string;
  now: Date | null;
  onStaffSelect: (staffId: string) => void;
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function DailyTimelineAvailableCard({ rows, date, now, onStaffSelect }: Props) {
  const available = rows.filter((row) => {
    const status = getTimelineStatus(row, date, now);
    return status === "available" || status === "scheduled";
  });

  return (
    <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
          <Users className="size-4 text-emerald-700" />
          Available {isToday(date) ? "Now" : "On Date"}
        </h3>
        <span className="text-[10px] font-semibold tabular-nums text-[var(--cs-text-muted)]">{available.length}</span>
      </div>
      <div className="mt-2 divide-y divide-[var(--cs-border-soft)]">
        {available.slice(0, 5).map((row) => (
          <button
            key={row.staff_id}
            type="button"
            onClick={() => onStaffSelect(row.staff_id)}
            className="flex w-full items-center gap-2 py-2 text-left hover:text-emerald-800"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[9px] font-bold text-emerald-800">
              {getInitials(row.staff_name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-semibold">{row.staff_name}</span>
              <span className="block truncate text-[9px] text-[var(--cs-text-muted)]">
                {row.work_start && row.work_end ? `${formatScheduleTime(row.work_start)} - ${formatScheduleTime(row.work_end)}` : "Scheduled"}
              </span>
            </span>
            <ChevronRight className="size-3 text-stone-400" />
          </button>
        ))}
        {available.length === 0 ? <p className="py-3 text-xs text-[var(--cs-text-muted)]">No available staff in this view.</p> : null}
      </div>
    </section>
  );
}
