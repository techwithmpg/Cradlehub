import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffWeekAppointment } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";

const TYPE_META: Record<StaffWeekAppointment["type"], { label: string; className: string }> = {
  in_spa: {
    label: "In-Spa",
    className: styles.typeBadgeInSpa ?? "",
  },
  home: {
    label: "Home",
    className: styles.typeBadgeHome ?? "",
  },
  walk_in: {
    label: "Walk-In",
    className: styles.typeBadgeWalkIn ?? "",
  },
  online: {
    label: "Online",
    className: styles.typeBadgeOnline ?? "",
  },
};

type WeekAppointmentItemProps = {
  appointment: StaffWeekAppointment;
  compact?: boolean;
};

export function WeekAppointmentItem({ appointment, compact = false }: WeekAppointmentItemProps) {
  const typeMeta = TYPE_META[appointment.type];

  return (
    <article className={cn(styles.appointmentItem, compact && styles.appointmentItemCompact)}>
      <div className={styles.appointmentTop}>
        <p className={styles.appointmentTime}>{appointment.timeLabel}</p>
        {appointment.hasNote && (
          <span className={styles.noteHint}>
            <FileText size={11} />
            note
          </span>
        )}
      </div>

      <p className={styles.appointmentCustomer}>{appointment.customerName}</p>
      <p className={styles.appointmentService}>
        {appointment.serviceName} · {appointment.durationMinutes}m
      </p>

      <span className={cn(styles.typeBadge, typeMeta.className)}>{typeMeta.label}</span>
    </article>
  );
}
