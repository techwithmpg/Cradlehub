const STATUS: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  confirmed: {
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success-text)",
    label: "Confirmed",
    dot: "var(--cs-success)",
  },
  in_progress: {
    bg: "var(--cs-info-bg)",
    color: "var(--cs-info-text)",
    label: "In Progress",
    dot: "var(--cs-info)",
  },
  completed: {
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success-text)",
    label: "Completed",
    dot: "var(--cs-success)",
  },
  cancelled: {
    bg: "var(--cs-error-bg)",
    color: "var(--cs-error-text)",
    label: "Cancelled",
    dot: "var(--cs-error)",
  },
  no_show: {
    bg: "var(--cs-error-bg)",
    color: "var(--cs-error-text)",
    label: "No Show",
    dot: "var(--cs-error)",
  },
  pending: {
    bg: "var(--cs-warning-bg)",
    color: "var(--cs-warning-text)",
    label: "Pending",
    dot: "var(--cs-warning)",
  },
  pending_payment: {
    bg: "var(--cs-warning-bg)",
    color: "var(--cs-warning-text)",
    label: "Pending Payment",
    dot: "var(--cs-warning)",
  },
  pending_crm_confirmation: {
    bg: "var(--cs-warning-bg)",
    color: "var(--cs-warning-text)",
    label: "Pending CRM",
    dot: "var(--cs-warning)",
  },
  expired: {
    bg: "var(--cs-neutral-bg)",
    color: "var(--cs-neutral-text)",
    label: "Expired",
    dot: "var(--cs-neutral)",
  },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS["pending"]!;
  return (
    <span
      className="cs-badge inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: s.dot }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}
