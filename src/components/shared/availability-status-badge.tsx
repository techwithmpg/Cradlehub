const AVAILABILITY_CONFIG: Record<string, { label: string; color: string }> = {
  available_now:  { label: "Available",      color: "var(--cs-success)"    },
  busy_now:       { label: "Busy",           color: "var(--cs-info)"       },
  not_checked_in: { label: "Not checked in", color: "var(--cs-warning)"    },
  checked_out:    { label: "Checked out",    color: "var(--cs-text-muted)" },
  off_today:      { label: "Off",            color: "var(--cs-text-muted)" },
  no_schedule:    { label: "No schedule",    color: "var(--cs-warning)"    },
  conflict:       { label: "Conflict",       color: "var(--cs-error, #b91c1c)" },
};

export function AvailabilityStatusBadge({ status }: { status: string }) {
  const cfg = AVAILABILITY_CONFIG[status] ?? { label: status, color: "var(--cs-text-muted)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: cfg.color, fontWeight: 500 }}>
        {cfg.label}
      </span>
    </div>
  );
}
