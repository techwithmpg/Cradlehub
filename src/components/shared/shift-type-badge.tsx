const SHIFT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  opening: { label: "Opening", bg: "rgba(74,124,89,0.12)",  color: "#4A7C59" },
  closing: { label: "Closing", bg: "rgba(37,99,235,0.12)",  color: "#2563EB" },
  single:  { label: "Regular", bg: "rgba(166,123,91,0.12)", color: "var(--cs-sand-dark)" },
};

export function ShiftTypeBadge({ shiftType }: { shiftType: string }) {
  const cfg = SHIFT_CONFIG[shiftType] ?? SHIFT_CONFIG.single!;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--cs-r-pill)",
        fontSize: 10,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {cfg.label}
    </span>
  );
}
