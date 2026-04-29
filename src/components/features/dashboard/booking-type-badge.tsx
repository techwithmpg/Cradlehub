const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  online: { bg: "#EFF6FF", color: "#1D4ED8", label: "Online" },
  walkin: { bg: "#F0FDF4", color: "#15803D", label: "Walk-in" },
  home_service: {
    bg: "var(--ch-accent-light)",
    color: "var(--ch-accent)",
    label: "Home Service",
  },
};

export function BookingTypeBadge({ type }: { type: string }) {
  const t = TYPE_STYLES[type] ?? { bg: "#F9FAFB", color: "#6B7280", label: type };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: t.bg,
        color: t.color,
        whiteSpace: "nowrap",
      }}
    >
      {t.label}
    </span>
  );
}
