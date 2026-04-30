const TYPE: Record<string, { bg: string; color: string; label: string }> = {
  online:       { bg: "var(--cs-info-bg)",    color: "var(--cs-info-text)",    label: "Online"       },
  walkin:       { bg: "var(--cs-success-bg)", color: "var(--cs-success-text)", label: "Walk-in"      },
  home_service: { bg: "var(--cs-sand-mist)",  color: "var(--cs-sand-dark)",    label: "Home Service" },
};

export function BookingTypeBadge({ type }: { type: string }) {
  const t = TYPE[type] ?? { bg: "var(--cs-neutral-bg)", color: "var(--cs-neutral-text)", label: type };
  return (
    <span
      className="cs-badge"
      style={{ backgroundColor: t.bg, color: t.color }}
    >
      {t.label}
    </span>
  );
}
