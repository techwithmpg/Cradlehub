import { formatWeekRange, type StaffWeekDay, type StaffWeekSummary } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";
import { MobileWeekAccordion } from "./mobile-week-accordion";
import { MyWeekHeader } from "./my-week-header";
import { MyWeekStats } from "./my-week-stats";
import { WeekBoard } from "./week-board";

type MyWeekPageProps = {
  fromDate: string;
  toDate: string;
  previousWeekStart: string;
  nextWeekStart: string;
  currentWeekStart: string;
  isCurrentWeek: boolean;
  days: StaffWeekDay[];
  summary: StaffWeekSummary;
};

export function MyWeekPage({
  fromDate,
  toDate,
  previousWeekStart,
  nextWeekStart,
  currentWeekStart,
  isCurrentWeek,
  days,
  summary,
}: MyWeekPageProps) {
  const rangeLabel = formatWeekRange(fromDate, toDate);
  const previousHref = `/staff-portal/week?weekStart=${previousWeekStart}`;
  const nextHref = `/staff-portal/week?weekStart=${nextWeekStart}`;
  const currentHref = `/staff-portal/week?weekStart=${currentWeekStart}`;

  return (
    <div className={styles.wrapper}>
      <MyWeekHeader
        rangeLabel={rangeLabel}
        previousHref={previousHref}
        nextHref={nextHref}
        currentHref={currentHref}
        isCurrentWeek={isCurrentWeek}
      />

      <MyWeekStats summary={summary} />

      {summary.totalAppointments === 0 && (
        <section className={styles.emptyWeekBanner}>
          <p className={styles.emptyWeekTitle}>No appointments this week</p>
          <p className={styles.emptyWeekBody}>
            Your schedule is open for this week. New bookings will appear here automatically.
          </p>
        </section>
      )}

      <WeekBoard days={days} />
      <MobileWeekAccordion days={days} />
    </div>
  );
}
