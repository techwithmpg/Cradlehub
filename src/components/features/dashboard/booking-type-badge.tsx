const TYPE: Record<string, { bg: string; color: string; label: string }> = {
  online:       { bg: "#EDF3F8", color: "#4A6B82", label: "Online"       },
  walkin:       { bg: "#EAF0EA", color: "#4A6B52", label: "Walk-in"      },
  home_service: { bg: "#F5EDE3", color: "#7A5233", label: "Home Service" },
};

export function BookingTypeBadge({ type }: { type: string }) {
  const t = TYPE[type] ?? { bg: "#F5F0EA", color: "#7A6A5A", label: type };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px",
      borderRadius: "var(--cs-radius-pill)",
      fontSize: "0.6875rem", fontWeight: 600,
      backgroundColor: t.bg, color: t.color, whiteSpace: "nowrap" as const,
    }}>
      {t.label}
    </span>
  );
}
