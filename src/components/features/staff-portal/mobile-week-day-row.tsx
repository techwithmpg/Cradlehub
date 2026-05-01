"use client";

import { ChevronDown, Leaf } from "lucide-react";
import type { StaffWeekDay } from "@/lib/staff-portal/week";
import {
  calculateTotalMinutesPerDay,
  formatAppointmentCountText,
  formatBookedHoursFromMinutes,
} from "@/lib/staff-portal/week-summary";
import styles from "./my-week-page.module.css";
import { WeekAppointmentItem } from "./week-appointment-item";
import { WeekDayEmptyState } from "./week-day-empty-state";

type MobileWeekDayRowProps = {
  day: StaffWeekDay;
  isOpen: boolean;
  onToggle: (date: string) => void;
};

function rowMeta(day: StaffWeekDay): string {
  const countText = formatAppointmentCountText(day.appointmentCount);
  if (day.appointmentCount === 0) return countText;
  return `${countText} • ${formatBookedHoursFromMinutes(calculateTotalMinutesPerDay(day))}`;
}

function actionLabel(day: StaffWeekDay, isOpen: boolean): string {
  const verb = isOpen ? "Collapse" : "Expand";
  return `${verb} ${day.dayNameFull}, ${day.date}, ${formatAppointmentCountText(day.appointmentCount)}`;
}

export function MobileWeekDayRow({ day, isOpen, onToggle }: MobileWeekDayRowProps) {
  const panelId = `staff-week-day-panel-${day.date}`;

  return (
    <section className={`${styles.mobileDay} ${day.isToday ? styles.mobileDayToday : ""}`}>
      <button
        type="button"
        className={styles.mobileSummaryButton}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={actionLabel(day, isOpen)}
        onClick={() => onToggle(day.date)}
      >
        <div className={styles.mobileLeft}>
          <p className={styles.mobileDayLabel}>
            {day.dayNameShort} {day.dayOfMonth}
          </p>
          {day.isToday && <span className={styles.todayBadge}>TODAY</span>}
        </div>

        <div className={styles.mobileRight}>
          <p className={styles.mobileMeta}>{rowMeta(day)}</p>
          {day.appointmentCount === 0 && <Leaf size={14} className={styles.mobileLeaf} aria-hidden="true" />}
          <ChevronDown size={16} className={`${styles.mobileChevron} ${isOpen ? styles.mobileChevronOpen : ""}`} />
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={`${day.dayNameFull} appointments`}
        className={`${styles.mobilePanel} ${isOpen ? styles.mobilePanelOpen : ""}`}
      >
        <div className={styles.mobileContent}>
          {day.appointmentCount === 0 ? (
            <WeekDayEmptyState isDayOff={day.isDayOff} />
          ) : (
            day.appointments.map((appointment) => (
              <WeekAppointmentItem key={appointment.id} appointment={appointment} compact />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
