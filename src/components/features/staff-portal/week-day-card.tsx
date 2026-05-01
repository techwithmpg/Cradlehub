import type { StaffWeekDay } from "@/lib/staff-portal/week";
import {
  calculateTotalMinutesPerDay,
  formatAppointmentCountText,
  formatBookedHoursFromMinutes,
} from "@/lib/staff-portal/week-summary";
import styles from "./my-week-page.module.css";
import { WeekAppointmentItem } from "./week-appointment-item";
import { WeekDayEmptyState } from "./week-day-empty-state";

type WeekDayCardProps = {
  day: StaffWeekDay;
};

function appointmentMeta(day: StaffWeekDay): string {
  return `${formatAppointmentCountText(day.appointmentCount)} • ${formatBookedHoursFromMinutes(calculateTotalMinutesPerDay(day))}`;
}

export function WeekDayCard({ day }: WeekDayCardProps) {
  const workHoursLabel = day.workHoursLabel ?? "Not scheduled";

  return (
    <section className={`${styles.dayCard} ${day.isToday ? styles.dayCardToday : ""}`}>
      <header className={styles.dayHeader}>
        <div className={styles.dayTitleRow}>
          <div>
            <p className={styles.dayName}>{day.dayNameShort}</p>
            <p className={styles.dayDate}>{day.dayNumber}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {day.isToday && <span className={styles.todayBadge}>TODAY</span>}
            <span className={styles.countBubble}>{day.appointmentCount}</span>
          </div>
        </div>

        <p className={styles.dayMeta}>{appointmentMeta(day)}</p>
        <p className={styles.dayWorkHours}>
          {workHoursLabel}
          {day.hasOverride && !day.isDayOff ? " • Override" : ""}
        </p>
      </header>

      <div className={styles.dayBody}>
        {day.appointmentCount === 0 ? (
          <WeekDayEmptyState isDayOff={day.isDayOff} />
        ) : (
          <div className={styles.appointmentsList}>
            {day.appointments.map((appointment) => (
              <WeekAppointmentItem key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
