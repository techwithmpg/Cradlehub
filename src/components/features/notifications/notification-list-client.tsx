"use client";

import { useState } from "react";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationCard } from "./notification-card";

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
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
  }

  if (!items.length) {
    return (
      <div style={{
        padding:      "32px 16px",
        textAlign:    "center",
        color:        "var(--cs-text-muted)",
        fontSize:     12,
        borderRadius: "var(--cs-r-sm)",
        border:       "1px solid var(--cs-border-soft)",
      }}>
        No active notifications.
      </div>
    );
  }

  return (
    <div>
      {items.map((n) => (
        <NotificationCard
          key={n.id}
          notification={n}
          onDismiss={() => remove(n.id)}
          onMarkRead={() => markRead(n.id)}
        />
      ))}
    </div>
  );
}
