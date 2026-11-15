type Segment = "new" | "repeat" | "lapsed" | "vip";

const SEGMENT_STYLES: Record<
  Segment,
  { label: string; bg: string; color: string }
> = {
  new: {
    label: "New",
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success-text)",
  },
  repeat: {
    label: "Repeat",
    bg: "var(--cs-sand-mist)",
    color: "var(--cs-sand)",
  },
  lapsed: {
    label: "Lapsed",
    bg: "var(--cs-warning-bg)",
    color: "var(--cs-warning-text)",
  },
  vip: {
    label: "VIP",
    bg: "var(--cs-sand-mist)",
    color: "var(--cs-sand-dark)",
  },
};

export function CustomerSegmentBadge({ segment }: { segment: Segment }) {
  const style = SEGMENT_STYLES[segment];
  return (
    <span
      className="cs-badge inline-flex items-center whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}
