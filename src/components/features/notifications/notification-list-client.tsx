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
      <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-8 text-center text-xs text-[var(--cs-text-muted)]">
        No active notifications.
      </div>
    );
  }

  const { actionRequired, unread, earlier, resolved } = groupNotifications(items);

  return (
    <div className="flex flex-col gap-5">
      <NotificationSection
        title="Action Required"
        items={actionRequired}
        color="var(--cs-warning)"
        count={actionRequired.length}
        onMarkRead={markRead}
        onDismiss={remove}
      />
      <NotificationSection
        title="Updates"
        items={unread}
        color="#1F4E33"
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
