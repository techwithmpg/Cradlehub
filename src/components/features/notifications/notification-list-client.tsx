"use client";

import { useState } from "react";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationSection } from "./notification-section";

function groupNotifications(items: WorkspaceNotification[]) {
  return {
    actionRequired: items.filter((n) => n.requires_action && n.status !== "resolved"),
    unread: items.filter((n) => n.status === "unread" && !n.requires_action),
    earlier: items.filter((n) => n.status === "read" && !n.requires_action),
    resolved: items.filter((n) => n.status === "resolved"),
  };
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

  const { actionRequired, unread, earlier, resolved } = groupNotifications(items);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <NotificationSection
        title="Action Required"
        items={actionRequired}
        color="var(--cs-sand)"
        count={actionRequired.length}
        onMarkRead={markRead}
        onDismiss={remove}
      />
      <NotificationSection
        title="Updates"
        items={unread}
        color="var(--cs-sand)"
        count={unread.length}
        onMarkRead={markRead}
        onDismiss={remove}
      />
      <NotificationSection
        title="Activity"
        items={earlier}
        color="var(--cs-text-muted)"
        onMarkRead={markRead}
        onDismiss={remove}
      />
      <NotificationSection
        title="Resolved"
        items={resolved}
        color="var(--cs-success)"
        onMarkRead={markRead}
        onDismiss={remove}
      />
    </div>
  );
}
