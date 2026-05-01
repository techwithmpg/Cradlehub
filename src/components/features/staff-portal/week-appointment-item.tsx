import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffWeekAppointment } from "@/lib/staff-portal/week";
import styles from "./my-week-page.module.css";

const TYPE_META: Record<string, { label: string; className: string }> = {
  in_spa: {
    label: "In-Spa",
    className: styles.typeBadgeInSpa ?? "",
  },
  home_service: {
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

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: styles.statusBadgePending ?? "" },
  confirmed: { label: "Confirmed", className: styles.statusBadgeConfirmed ?? "" },
  in_progress: { label: "In Progress", className: styles.statusBadgeInProgress ?? "" },
  completed: { label: "Completed", className: styles.statusBadgeCompleted ?? "" },
  cancelled: { label: "Cancelled", className: styles.statusBadgeCancelled ?? "" },
  no_show: { label: "No Show", className: styles.statusBadgeNoShow ?? "" },
};

type WeekAppointmentItemProps = {
  appointment: StaffWeekAppointment;
  compact?: boolean;
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

export function WeekAppointmentItem({ appointment, compact = false }: WeekAppointmentItemProps) {
  const typeMeta = TYPE_META[appointment.bookingType] ?? {
    label: appointment.bookingType,
    className: styles.typeBadgeInSpa ?? "",
  };
  const statusMeta = STATUS_META[normalizeStatus(appointment.status)] ?? {
    label: appointment.status,
    className: styles.statusBadgePending ?? "",
  };

  return (
    <article className={cn(styles.appointmentItem, compact && styles.appointmentItemCompact)}>
      <div className={styles.appointmentMainRow}>
        <p className={styles.appointmentTime}>{appointment.timeLabel}</p>

        <div className={styles.appointmentDetails}>
          <div className={styles.appointmentDetailsTop}>
            <p className={styles.appointmentCustomer}>{appointment.customerName}</p>
            <div className={styles.badgeRow}>
              <span className={cn(styles.typeBadge, typeMeta.className)}>{typeMeta.label}</span>
              <span className={cn(styles.statusBadge, statusMeta.className)}>{statusMeta.label}</span>
            </div>
          </div>

          <p className={styles.appointmentService}>{appointment.serviceName}</p>
        </div>
      </div>

      <div className={styles.appointmentMetaRow}>
        <span className={styles.durationHint}>{appointment.durationMinutes}m</span>
        {appointment.hasNote && (
          <span className={styles.noteHint}>
            <FileText size={11} />
            note
          </span>
        )}
      </div>
    </article>
  );
}
