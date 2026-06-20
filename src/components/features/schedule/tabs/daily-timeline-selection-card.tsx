import Link from "next/link";
import { CalendarDays, ChevronRight, UserRound } from "lucide-react";
import type { DailyScheduleBooking, DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import { getStaffTypeLabel, getTimelineStatus } from "./daily-timeline-operations";

type Props = {
  staff: DailyScheduleStaffRow | null;
  booking: DailyScheduleBooking | null;
  staffType: string | null;
  date: string;
  now: Date | null;
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[var(--cs-border-soft)] py-2 text-[11px]">
      <span className="shrink-0 text-[var(--cs-text-muted)]">{label}</span>
      <span className="min-w-0 text-right font-semibold text-[var(--cs-text)]">{value}</span>
    </div>
  );
}

export function DailyTimelineSelectionCard({ staff, booking, staffType, date, now }: Props) {
  if (!staff) {
    return (
      <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--cs-text)]">Selected Staff</h3>
        <p className="mt-3 text-xs text-[var(--cs-text-muted)]">Select a staff row or booking to inspect it.</p>
      </section>
    );
  }

  const status = getTimelineStatus(staff, date, now);
  return (
    <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--cs-text)]">{booking ? "Selected Booking" : "Selected Staff"}</h3>
      <div className="mt-3 flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-900">
          {getInitials(staff.staff_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[var(--cs-text)]">{staff.staff_name}</p>
          <p className="truncate text-[10px] text-[var(--cs-text-muted)]">{getStaffTypeLabel(staffType)}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold capitalize text-emerald-800">{status}</span>
      </div>

      {booking ? (
        <div className="mt-3">
          <DetailRow label="Service" value={booking.service} />
          <DetailRow label="Customer" value={booking.customer} />
          <DetailRow label="Time" value={`${formatScheduleTime(booking.start_time)} - ${formatScheduleTime(booking.end_time)}`} />
          <DetailRow label="Status" value={<span className="capitalize">{booking.status.replaceAll("_", " ")}</span>} />
          {booking.resource_name ? <DetailRow label="Room" value={booking.resource_name} /> : null}
        </div>
      ) : (
        <div className="mt-3">
          <DetailRow
            label="Shift"
            value={staff.schedule_windows.length > 0
              ? staff.schedule_windows.map((window) => `${formatScheduleTime(window.startTime)} - ${formatScheduleTime(window.endTime)}`).join(", ")
              : "Day off"}
          />
          <DetailRow label="Bookings" value={staff.bookings.length} />
          <DetailRow label="Blocked periods" value={staff.blocks.length} />
          <DetailRow label="Schedule source" value={<span className="capitalize">{staff.schedule_source}</span>} />
        </div>
      )}

      <Link
        href={booking ? "/crm/bookings" : "/crm/staff-availability?tab=individual"}
        className="mt-3 flex h-8 items-center justify-center gap-2 rounded-md bg-stone-50 text-[10px] font-semibold text-[var(--cs-text-secondary)] hover:bg-stone-100"
      >
        {booking ? <CalendarDays className="size-3" /> : <UserRound className="size-3" />}
        {booking ? "View Bookings" : "View Full Schedule"}
        <ChevronRight className="size-3" />
      </Link>
    </section>
  );
}
