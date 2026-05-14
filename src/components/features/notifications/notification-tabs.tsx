"use client";

export type NotificationTab = "action" | "updates" | "resolved" | "activity";

type Props = {
  active: NotificationTab;
  onChange: (tab: NotificationTab) => void;
  counts: Record<NotificationTab, number>;
};

const TABS: { key: NotificationTab; label: string }[] = [
  { key: "action", label: "Action Required" },
  { key: "updates", label: "Updates" },
  { key: "resolved", label: "Resolved" },
  { key: "activity", label: "Activity" },
];

export function NotificationTabs({ active, onChange, counts }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--cs-border-soft)",
        marginBottom: 4,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            flex: 1,
            padding: "6px 4px",
            fontSize: 11.5,
            fontWeight: active === t.key ? 600 : 500,
            color:
              active === t.key ? "var(--cs-sand)" : "var(--cs-text-muted)",
            background: active === t.key ? "var(--cs-sand-mist)" : "transparent",
            border: "none",
            borderBottom:
              active === t.key
                ? "2px solid var(--cs-sand)"
                : "2px solid transparent",
            cursor: "pointer",
            borderRadius: "var(--cs-r-xs) var(--cs-r-xs) 0 0",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          {t.label}
          {counts[t.key] > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: active === t.key ? "var(--cs-sand)" : "var(--cs-text-subtle)",
                background:
                  active === t.key
                    ? "rgba(200,169,107,0.2)"
                    : "var(--cs-surface-warm)",
                borderRadius: "9999px",
                padding: "0 5px",
                lineHeight: 1.5,
              }}
            >
              {counts[t.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
