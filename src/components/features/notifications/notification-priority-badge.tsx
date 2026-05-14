import type { NotificationPriority } from "@/lib/notifications/types";

const PRIORITY_STYLE: Record<NotificationPriority, { label: string; color: string; background: string }> = {
  low: {
    label: "Low",
    color: "var(--cs-text-muted)",
    background: "var(--cs-surface-warm)",
  },
  normal: {
    label: "Normal",
    color: "var(--cs-sand)",
    background: "var(--cs-sand-mist)",
  },
  high: {
    label: "High",
    color: "#92400E",
    background: "#FEF3C7",
  },
  critical: {
    label: "Critical",
    color: "#991B1B",
    background: "#FEE2E2",
  },
};

export function NotificationPriorityBadge({
  priority,
}: {
  priority: NotificationPriority | string;
}) {
  const style = PRIORITY_STYLE[priority as NotificationPriority] ?? PRIORITY_STYLE.normal;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        padding: "2px 8px",
        background: style.background,
        color: style.color,
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: 1.4,
      }}
    >
      {style.label}
    </span>
  );
}
