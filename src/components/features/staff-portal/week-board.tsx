import type { StaffWeekDay } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";
import { WeekDayCard } from "./week-day-card";

type WeekBoardProps = {
  days: StaffWeekDay[];
};

export function WeekBoard({ days }: WeekBoardProps) {
  return (
    <div className={styles.desktopBoardWrap}>
      <div className={styles.desktopBoard}>
        {days.map((day) => (
          <WeekDayCard key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}
