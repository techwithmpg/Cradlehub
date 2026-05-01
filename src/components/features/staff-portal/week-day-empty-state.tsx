import { Leaf } from "lucide-react";
import styles from "./my-week-page.module.css";

type WeekDayEmptyStateProps = {
  isDayOff: boolean;
};

export function WeekDayEmptyState({ isDayOff }: WeekDayEmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <Leaf size={16} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>No appointments</p>
      <p className={styles.emptyBody}>
        {isDayOff ? "Enjoy your day off" : "Open availability"}
      </p>
    </div>
  );
}
