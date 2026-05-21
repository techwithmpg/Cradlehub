const PRESENCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  checked_in:     { label: "Checked in",     color: "#4A7C59",              bg: "rgba(74,124,89,0.12)"   },
  not_checked_in: { label: "Not checked in", color: "#D97706",              bg: "rgba(217,119,6,0.1)"    },
  checked_out:    { label: "Checked out",    color: "var(--cs-text-muted)", bg: "rgba(107,114,128,0.1)"  },
  off_today:      { label: "Off today",      color: "var(--cs-text-muted)", bg: "rgba(107,114,128,0.1)"  },
  no_schedule:    { label: "No schedule",    color: "#D97706",              bg: "rgba(217,119,6,0.1)"    },
};

export function PresenceStatusBadge({ status }: { status: string }) {
  const cfg = PRESENCE_CONFIG[status] ?? {
    label: status,
    color: "var(--cs-text-muted)",
    bg: "rgba(107,114,128,0.1)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}
