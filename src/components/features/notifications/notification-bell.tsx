"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getRecentNotificationsAction,
  getUnreadCountAction,
} from "@/lib/notifications/queries";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationBellDropdown } from "./notification-bell-dropdown";

const WORKSPACE_HREF: Record<string, string> = {
  owner: "/owner/notifications",
  manager: "/manager",
  crm: "/crm/notifications",
  csr_head: "/crm/notifications",
  csr_staff: "/crm/notifications",
  csr: "/crm/notifications",
  staff: "/staff-portal/notifications",
  driver: "/driver",
  utility: "/utility",
};

export function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const href = WORKSPACE_HREF[role] ?? "/owner/notifications";

  // Initial badge count
  useEffect(() => {
    getUnreadCountAction().then(setCount).catch(() => {});
  }, []);

  // Refresh badge count periodically when closed
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      getUnreadCountAction().then(setCount).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [open]);

  const toggleOpen = useCallback(async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      setFetching(true);
      try {
        const [notifications, unreadCount] = await Promise.all([
          getRecentNotificationsAction(20),
          getUnreadCountAction(),
        ]);
        setItems(notifications);
        setCount(unreadCount);
      } catch {
        setItems([]);
      } finally {
        setFetching(false);
      }
    }
  }, [open]);

  const remove = useCallback((id: string) => {
    const target = items.find((item) => item.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (target?.status === "unread") {
      setCount((prev) => Math.max(0, prev - 1));
    }
  }, [items]);

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "read" as const } : item))
    );
    setCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "unread" ? { ...item, status: "read" as const } : item
      )
    );
    setCount(0);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notification-bell]")) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div data-notification-bell style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open ? "true" : "false"}
        aria-label={
          count > 0
            ? `${count} unread notification${count === 1 ? "" : "s"}`
            : "Notifications"
        }
        title={
          count > 0
            ? `${count} unread notification${count === 1 ? "" : "s"}`
            : "Notifications"
        }
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "var(--cs-r-xs)",
          color: count > 0 ? "var(--cs-text)" : "var(--cs-text-muted)",
          background: open ? "var(--cs-surface-raised)" : "transparent",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
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
          <span
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              background: "var(--cs-sand)",
              color: "#fff",
              borderRadius: "9999px",
              fontSize: 9,
              fontWeight: 700,
              minWidth: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              letterSpacing: "0.02em",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <NotificationBellDropdown
          items={items}
          roleHref={href}
          onMarkRead={markRead}
          onDismiss={remove}
          onMarkAllRead={markAllRead}
        />
      )}

      {fetching && !items.length && open && (
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            width: "min(380px, calc(100vw - 32px))",
            padding: "18px 8px",
            fontSize: 12,
            color: "var(--cs-text-muted)",
            textAlign: "center",
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: "var(--cs-r-md)",
            boxShadow: "var(--cs-shadow-lg)",
            zIndex: 50,
          }}
        >
          Loading…
        </div>
      )}
    </div>
  );
}
