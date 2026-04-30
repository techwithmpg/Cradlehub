const STATUS: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  confirmed:   { bg: "var(--cs-info-bg)",    color: "var(--cs-info-text)",    label: "Confirmed",   dot: "var(--cs-info)"         },
  in_progress: { bg: "var(--cs-owner-bg)",   color: "var(--cs-owner-text)",   label: "In Progress", dot: "var(--cs-owner-accent)" },
  completed:   { bg: "var(--cs-success-bg)", color: "var(--cs-success-text)", label: "Completed",   dot: "var(--cs-success)"      },
  cancelled:   { bg: "var(--cs-neutral-bg)", color: "var(--cs-neutral-text)", label: "Cancelled",   dot: "var(--cs-neutral)"      },
  no_show:     { bg: "var(--cs-warning-bg)", color: "var(--cs-warning-text)", label: "No Show",     dot: "var(--cs-warning)"      },
  pending:     { bg: "var(--cs-sand-mist)",  color: "var(--cs-sand-dark)",    label: "Pending",     dot: "var(--cs-sand)"         },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS["pending"]!;
  return (
    <span
      className="cs-badge"
      style={{ backgroundColor: s.bg, color: s.color, display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
