"use client";

import { useState } from "react";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationRow } from "./notification-row";

function groupNotifications(items: WorkspaceNotification[]) {
  const actionRequired = items.filter((n) => n.requires_action);
  const unread = items.filter((n) => n.status === "unread" && !n.requires_action);
  const earlier = items.filter((n) => n.status === "read" && !n.requires_action);
  return { actionRequired, unread, earlier };
}

export function NotificationListClient({
  initialNotifications,
}: {
  initialNotifications: WorkspaceNotification[];
}) {
  const [items, setItems] = useState(initialNotifications);

  function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n))
    );
  }

  if (!items.length) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: 12,
          borderRadius: "var(--cs-r-sm)",
          border: "1px solid var(--cs-border-soft)",
        }}
      >
        No active notifications.
      </div>
    );
  }

  const { actionRequired, unread, earlier } = groupNotifications(items);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {actionRequired.length > 0 && (
        <section>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--cs-error)",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--cs-error)",
              }}
            />
            Action Required
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#fff",
                background: "var(--cs-error)",
                borderRadius: "9999px",
                padding: "0 6px",
                lineHeight: 1.5,
              }}
            >
              {actionRequired.length}
            </span>
          </div>
          <div
            style={{
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              overflow: "hidden",
            }}
          >
            {actionRequired.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={() => markRead(n.id)}
                onDismiss={() => remove(n.id)}
              />
            ))}
          </div>
        </section>
      )}

      {unread.length > 0 && (
        <section>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--cs-sand)",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--cs-sand)",
              }}
            />
            Unread
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--cs-sand)",
                background: "var(--cs-sand-mist)",
                borderRadius: "9999px",
                padding: "0 6px",
                lineHeight: 1.5,
              }}
            >
              {unread.length}
            </span>
          </div>
          <div
            style={{
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              overflow: "hidden",
            }}
          >
            {unread.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={() => markRead(n.id)}
                onDismiss={() => remove(n.id)}
              />
            ))}
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--cs-text-muted)",
              marginBottom: 6,
            }}
          >
            Earlier
          </div>
          <div
            style={{
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              overflow: "hidden",
            }}
          >
            {earlier.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={() => markRead(n.id)}
                onDismiss={() => remove(n.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
