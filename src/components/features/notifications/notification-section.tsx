"use client";

import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationRow } from "./notification-row";

type Props = {
  title: string;
  items: WorkspaceNotification[];
  color: string;
  count?: number;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function NotificationSection({
  title,
  items,
  color,
  count,
  onMarkRead,
  onDismiss,
}: Props) {
  if (!items.length) return null;

  return (
    <section>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
        {title}
        {typeof count === "number" && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: color,
              borderRadius: "9999px",
              padding: "0 6px",
              lineHeight: 1.5,
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div
        style={{
          borderRadius: "var(--cs-r-md)",
          border: "1px solid var(--cs-border-soft)",
          overflow: "hidden",
        }}
      >
        {items.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onMarkRead={() => onMarkRead(notification.id)}
            onDismiss={() => onDismiss(notification.id)}
          />
        ))}
      </div>
    </section>
  );
}
