"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationTabs, type NotificationTab } from "./notification-tabs";
import { NotificationRow } from "./notification-row";
import { markAllNotificationsReadAction } from "@/lib/notifications/queries";

type Props = {
  items: WorkspaceNotification[];
  roleHref: string;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
};

export function NotificationPopover({
  items,
  roleHref,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
}: Props) {
  const [activeTab, setActiveTab] = useState<NotificationTab>(
    items.some((n) => n.requires_action && n.status !== "resolved") ? "action" : "updates"
  );
  const [markingAll, setMarkingAll] = useState(false);

  function groupFor(notification: WorkspaceNotification): NotificationTab {
    if (notification.status === "resolved") return "resolved";
    if (notification.requires_action) return "action";
    if (notification.metadata?.signal_group === "activity") return "activity";
    return "updates";
  }

  const filtered = items.filter((n) => groupFor(n) === activeTab);

  const counts = {
    action: items.filter((n) => groupFor(n) === "action").length,
    updates: items.filter((n) => groupFor(n) === "updates").length,
    resolved: items.filter((n) => groupFor(n) === "resolved").length,
    activity: items.filter((n) => groupFor(n) === "activity").length,
  };

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsReadAction();
      onMarkAllRead();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Workspace notifications"
      style={{
        position: "absolute",
        top: 38,
        right: 0,
        width: "min(380px, calc(100vw - 32px))",
        maxHeight: "min(560px, calc(100vh - 88px))",
        overflowY: "auto",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: "var(--cs-r-md)",
        boxShadow: "var(--cs-shadow-lg)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 14px 8px",
          borderBottom: "1px solid var(--cs-border-soft)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
          Workflow Signals
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {items.some((item) => item.status === "unread") && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markingAll}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--cs-brand)",
                background: "none",
                border: "none",
                cursor: markingAll ? "wait" : "pointer",
                padding: 0,
                opacity: markingAll ? 0.6 : 1,
              }}
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
          )}
          <Link
            href={roleHref}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--cs-brand)",
              textDecoration: "none",
            }}
          >
            View all
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 8px", flexShrink: 0 }}>
        <NotificationTabs active={activeTab} onChange={setActiveTab} counts={counts} />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "28px 8px",
              fontSize: 12,
              color: "var(--cs-text-muted)",
              textAlign: "center",
            }}
          >
            {activeTab === "action"
              ? "No action items right now."
              : activeTab === "resolved"
              ? "No resolved items yet."
              : activeTab === "activity"
              ? "No activity summaries yet."
              : "No updates right now."}
          </div>
        ) : (
          <div>
            {filtered.map((item) => (
              <NotificationRow
                key={item.id}
                notification={item}
                onMarkRead={() => onMarkRead(item.id)}
                onDismiss={() => onDismiss(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
