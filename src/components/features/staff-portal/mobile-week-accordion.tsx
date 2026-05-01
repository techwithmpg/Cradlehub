import type { StaffWeekDay } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";
import { MobileWeekDayRow } from "./mobile-week-day-row";

type MobileWeekAccordionProps = {
  days: StaffWeekDay[];
};

export function MobileWeekAccordion({ days }: MobileWeekAccordionProps) {
  const preferredOpenDate =
    days.find((day) => day.isToday)?.date ??
    days.find((day) => day.appointmentCount > 0)?.date ??
    days[0]?.date;

  return (
    <section className={styles.mobileAccordion}>
      {days.map((day) => (
        <MobileWeekDayRow key={day.date} day={day} defaultOpen={day.date === preferredOpenDate} />
      ))}
    </section>
  );
}
