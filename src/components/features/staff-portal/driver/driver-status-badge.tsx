import type { DispatchStatus } from "@/features/dispatch/types";

const STATUS_LABEL: Record<DispatchStatus, string> = {
  awaiting_driver: "Assigned",
  ready: "Assigned",
  scheduled: "Scheduled",
  released_to_driver: "Released",
  in_route: "On the Way",
  arrived_at_customer: "Arrived",
  service_started: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<DispatchStatus, { bg: string; color: string; border: string }> = {
  awaiting_driver: { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", border: "var(--cs-border-soft)" },
  ready: { bg: "rgba(251,191,36,0.12)", color: "#92700A", border: "rgba(146,112,10,0.2)" },
  scheduled: { bg: "rgba(14,165,233,0.1)", color: "#0369A1", border: "rgba(14,165,233,0.18)" },
  released_to_driver: { bg: "rgba(99,102,241,0.1)", color: "#4F46E5", border: "rgba(99,102,241,0.18)" },
  in_route: { bg: "var(--cs-success-bg)", color: "var(--cs-success)", border: "rgba(90,138,106,0.2)" },
  arrived_at_customer: { bg: "rgba(59,130,246,0.1)", color: "#2563EB", border: "rgba(59,130,246,0.16)" },
  service_started: { bg: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "rgba(139,92,246,0.16)" },
  completed: { bg: "var(--cs-success-bg)", color: "var(--cs-success)", border: "rgba(90,138,106,0.2)" },
  cancelled: { bg: "rgba(239,68,68,0.08)", color: "#DC2626", border: "rgba(239,68,68,0.15)" },
};

export function getDriverStatusLabel(status: DispatchStatus): string {
  return STATUS_LABEL[status];
}

export function DriverStatusBadge({ status }: { status: DispatchStatus }) {
  const style = STATUS_STYLE[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        backgroundColor: style.bg,
        color: style.color,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
