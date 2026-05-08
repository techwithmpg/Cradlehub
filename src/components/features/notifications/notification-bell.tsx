"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getNotificationPopoverAction,
  getUnreadCountAction,
} from "@/lib/notifications/queries";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationCard } from "./notification-card";

const WORKSPACE_HREF: Record<string, string> = {
  owner:     "/owner/notifications",
  manager:   "/manager/notifications",
  crm:       "/crm/notifications",
  csr_head:  "/crm/notifications",
  csr_staff: "/crm/notifications",
  csr:       "/crm/notifications",
  staff:     "/staff-portal/notifications",
  driver:    "/driver/notifications",
  utility:   "/utility/notifications",
};

export function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    getUnreadCountAction().then(setCount).catch(() => {});
  }, []);

  const href = WORKSPACE_HREF[role] ?? "/owner/notifications";
  const actionCount = items.filter((item) => item.requires_action).length;

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);

    // Re-fetch fresh data every time the popover opens so read/dismiss
    // changes made on the notification page are immediately reflected here.
    if (nextOpen) {
      setFetching(true);
      try {
        const notifications = await getNotificationPopoverAction(8);
        setItems(notifications);
        // Sync badge to freshly-fetched unread count.
        setCount(notifications.filter((item) => item.status === "unread").length);
      } catch {
        setItems([]);
      } finally {
        setFetching(false);
      }
    }
  }

  function remove(id: string) {
    const target = items.find((item) => item.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    // Only decrement the unread badge when dismissing an unread notification.
    if (target?.status === "unread") {
      setCount((prev) => Math.max(0, prev - 1));
    }
  }

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "read" } : item))
    );
    setCount((prev) => Math.max(0, prev - 1));
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open ? "true" : "false"}
        aria-label={count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"}
        title={count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"}
        style={{
          position:       "relative",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          30,
          height:         30,
          borderRadius:   "var(--cs-r-xs)",
          color:          count > 0 ? "var(--cs-text)" : "var(--cs-text-muted)",
          background:     open ? "var(--cs-surface-raised)" : "transparent",
          border:         "none",
          cursor:         "pointer",
          flexShrink:     0,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {count > 0 && (
          <span style={{
            position:       "absolute",
            top:            1,
            right:          1,
            background:     "#ef4444",
            color:          "#fff",
            borderRadius:   "9999px",
            fontSize:       9,
            fontWeight:     700,
            minWidth:       14,
            height:         14,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        "0 3px",
            lineHeight:     1,
            letterSpacing:  "0.02em",
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Workspace notifications"
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            width: "min(360px, calc(100vw - 32px))",
            maxHeight: "min(520px, calc(100vh - 88px))",
            overflowY: "auto",
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: "var(--cs-r-md)",
            boxShadow: "var(--cs-shadow-lg)",
            padding: 12,
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
                Notifications
              </div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
                {actionCount > 0 ? `${actionCount} action item${actionCount === 1 ? "" : "s"}` : "No action required."}
              </div>
            </div>
            <Link
              href={href}
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

          {fetching ? (
            <div style={{ padding: "18px 8px", fontSize: 12, color: "var(--cs-text-muted)", textAlign: "center" }}>
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "22px 8px", fontSize: 12, color: "var(--cs-text-muted)", textAlign: "center" }}>
              No active notifications.
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <NotificationCard
                  key={item.id}
                  notification={item}
                  onDismiss={() => remove(item.id)}
                  onMarkRead={() => markRead(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
