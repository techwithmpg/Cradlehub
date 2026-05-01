import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./my-week-page.module.css";

type MyWeekHeaderProps = {
  rangeLabel: string;
  previousHref: string;
  nextHref: string;
  currentHref: string;
  isCurrentWeek: boolean;
};

export function MyWeekHeader({
  rangeLabel,
  previousHref,
  nextHref,
  currentHref,
  isCurrentWeek,
}: MyWeekHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon}>
              <Leaf size={16} />
            </span>
            <h2 className={cn(styles.title, "font-display")}>My Week</h2>
          </div>

          <div className={styles.rangeRow}>
            <span className={styles.rangeText}>{rangeLabel}</span>
            <Link
              href={currentHref}
              className={cn(styles.weekPill, isCurrentWeek && styles.weekPillCurrent)}
            >
              This Week
              <ChevronDown size={13} />
            </Link>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href={previousHref} className={styles.navButton} aria-label="Previous week">
            <ChevronLeft size={16} />
          </Link>
          <Link href={currentHref} className={`${styles.navButton} ${styles.calendarButton}`} aria-label="Go to this week">
            <CalendarDays size={14} />
            Calendar
          </Link>
          <Link href={nextHref} className={styles.navButton} aria-label="Next week">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
