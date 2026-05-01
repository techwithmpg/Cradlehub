import { Building2, CalendarCheck2, Clock3, House } from "lucide-react";
import { formatHours, type StaffWeekSummary } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";

type MyWeekStatsProps = {
  summary: StaffWeekSummary;
};

function percentOf(value: number, total: number): string {
  if (total <= 0) return "0% of total";
  const pct = Math.round((value / total) * 100);
  return `${pct}% of total`;
}

function averagePerDay(hoursBooked: number): string {
  if (hoursBooked <= 0) return "0h daily avg";
  const average = Math.round((hoursBooked / 7) * 10) / 10;
  return `${average.toFixed(1)}h daily avg`;
}

export function MyWeekStats({ summary }: MyWeekStatsProps) {
  return (
    <section className={styles.statsGrid}>
      <article className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{ backgroundColor: "var(--cs-success-bg)", color: "var(--cs-success)" }}
        >
          <CalendarCheck2 size={16} />
        </div>
        <div className={styles.statInfo}>
          <p className={styles.statLabel}>Total Appointments</p>
          <p className={styles.statValue}>{summary.totalAppointments}</p>
          <p className={styles.statSub}>{summary.upcoming} upcoming</p>
        </div>
      </article>

      <article className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{ backgroundColor: "var(--cs-sand-mist)", color: "var(--cs-sand-dark)" }}
        >
          <House size={16} />
        </div>
        <div className={styles.statInfo}>
          <p className={styles.statLabel}>Home Service</p>
          <p className={styles.statValue}>{summary.homeService}</p>
          <p className={styles.statSub}>{percentOf(summary.homeService, summary.totalAppointments)}</p>
        </div>
      </article>

      <article className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{ backgroundColor: "var(--cs-surface-warm)", color: "var(--cs-text-secondary)" }}
        >
          <Building2 size={16} />
        </div>
        <div className={styles.statInfo}>
          <p className={styles.statLabel}>In-Spa</p>
          <p className={styles.statValue}>{summary.inSpa}</p>
          <p className={styles.statSub}>{percentOf(summary.inSpa, summary.totalAppointments)}</p>
        </div>
      </article>

      <article className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{ backgroundColor: "var(--cs-info-bg)", color: "var(--cs-info)" }}
        >
          <Clock3 size={16} />
        </div>
        <div className={styles.statInfo}>
          <p className={styles.statLabel}>Hours Booked</p>
          <p className={styles.statValue}>{formatHours(summary.hoursBooked)}</p>
          <p className={styles.statSub}>{averagePerDay(summary.hoursBooked)}</p>
        </div>
      </article>
    </section>
  );
}
