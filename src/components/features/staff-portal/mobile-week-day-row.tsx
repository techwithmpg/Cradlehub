import { ChevronDown } from "lucide-react";
import { formatHours, type StaffWeekDay } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";
import { WeekAppointmentItem } from "./week-appointment-item";
import { WeekDayEmptyState } from "./week-day-empty-state";

type MobileWeekDayRowProps = {
  day: StaffWeekDay;
  defaultOpen: boolean;
};

function metaLabel(day: StaffWeekDay): string {
  const noun = day.appointmentCount === 1 ? "appt" : "appts";
  return `${day.appointmentCount} ${noun} • ${formatHours(day.bookedHours)}`;
}

export function MobileWeekDayRow({ day, defaultOpen }: MobileWeekDayRowProps) {
  return (
    <details className={styles.mobileDay} open={defaultOpen}>
      <summary className={styles.mobileSummary}>
        <div className={styles.mobileLeft}>
          <p className={styles.mobileDayLabel}>
            {day.dayNameShort} {day.dayOfMonth}
          </p>
          {day.isToday && <span className={styles.todayBadge}>TODAY</span>}
        </div>

        <div className={styles.mobileRight}>
          <p className={styles.mobileMeta}>{metaLabel(day)}</p>
          <ChevronDown size={16} className={styles.mobileChevron} />
        </div>
      </summary>

      <div className={styles.mobileContent}>
        {day.appointmentCount === 0 ? (
          <WeekDayEmptyState isDayOff={day.isDayOff} />
        ) : (
          day.appointments.map((appointment) => (
            <WeekAppointmentItem key={appointment.id} appointment={appointment} compact />
          ))
        )}
      </div>
    </details>
  );
}
