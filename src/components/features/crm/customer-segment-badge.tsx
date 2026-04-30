type Segment = "new" | "repeat" | "lapsed" | "vip";

const SEGMENT_STYLES: Record<
  Segment,
  { label: string; bg: string; color: string }
> = {
  new: {
    label: "New",
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success)",
  },
  repeat: {
    label: "Repeat",
    bg: "var(--cs-sand-mist)",
    color: "var(--cs-sand)",
  },
  lapsed: {
    label: "Lapsed",
    bg: "#FEF3C7",
    color: "#92400E",
  },
  vip: {
    label: "VIP",
    bg: "#F3E8FF",
    color: "#7C3AED",
  },
};

export function CustomerSegmentBadge({ segment }: { segment: Segment }) {
  const style = SEGMENT_STYLES[segment];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--cs-r-pill)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {style.label}
    </span>
  );
}

