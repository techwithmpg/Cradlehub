"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import {
  markNotificationReadAction,
  dismissNotificationAction,
} from "@/lib/notifications/queries";

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  normal:   "#3b82f6",
  low:      "var(--cs-text-subtle)",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type Props = {
  notification: WorkspaceNotification;
  onMarkRead?: () => void;
  onDismiss?: () => void;
};

export function NotificationCard({ notification: n, onMarkRead, onDismiss }: Props) {
  const [, startTransition] = useTransition();
  const isUnread = n.status === "unread";

  function handleMarkRead() {
    startTransition(async () => {
      await markNotificationReadAction(n.id);
      onMarkRead?.();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissNotificationAction(n.id);
      onDismiss?.();
    });
  }

  return (
    <div style={{
      display:      "flex",
      gap:          10,
      padding:      "10px 12px",
      borderRadius: "var(--cs-r-sm)",
      background:   isUnread ? "var(--cs-surface-raised)" : "var(--cs-surface)",
      border:       `1px solid ${isUnread ? "var(--cs-border)" : "var(--cs-border-soft)"}`,
      marginBottom: 6,
    }}>
      {/* Priority dot */}
      <div style={{ paddingTop: 3, flexShrink: 0 }}>
        <div style={{
          width:        7,
          height:       7,
          borderRadius: "50%",
          background:   PRIORITY_DOT[n.priority] ?? PRIORITY_DOT.normal,
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize:   12.5,
            fontWeight: isUnread ? 600 : 500,
            color:      "var(--cs-text)",
            lineHeight: 1.3,
          }}>
            {n.title}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--cs-text-subtle)", flexShrink: 0, paddingTop: 1 }}>
            {timeAgo(n.created_at)}
          </span>
        </div>

        {n.body && (
          <p style={{
            margin:     0,
            fontSize:   11.5,
            color:      "var(--cs-text-muted)",
            lineHeight: 1.45,
            marginBottom: 6,
          }}>
            {n.body}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {n.action_href && (
            <Link
              href={n.action_href}
              style={{
                fontSize:       11,
                color:          "var(--cs-brand)",
                fontWeight:     500,
                textDecoration: "none",
              }}
            >
              View →
            </Link>
          )}
          {isUnread && (
            <button
              type="button"
              onClick={handleMarkRead}
              style={{
                fontSize:   11,
                color:      "var(--cs-text-muted)",
                background: "none",
                border:     "none",
                cursor:     "pointer",
                padding:    0,
              }}
            >
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              fontSize:   11,
              color:      "var(--cs-text-subtle)",
              background: "none",
              border:     "none",
              cursor:     "pointer",
              padding:    0,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
