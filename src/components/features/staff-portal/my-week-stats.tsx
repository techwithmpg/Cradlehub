import { Building2, CalendarCheck2, Clock3, House } from "lucide-react";
import { formatHours, type StaffWeekSummary } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";

type MyWeekStatsProps = {
  summary: StaffWeekSummary;
};

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
          <p className={styles.statLabel}>Total</p>
          <p className={styles.statValue}>{summary.totalAppointments}</p>
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
          <p className={styles.statLabel}>Home</p>
          <p className={styles.statValue}>{summary.homeService}</p>
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
          <p className={styles.statLabel}>Hours</p>
          <p className={styles.statValue}>{formatHours(summary.hoursBooked)}</p>
        </div>
      </article>
    </section>
  );
}
