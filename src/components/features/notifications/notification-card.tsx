"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import {
  markNotificationReadAction,
  dismissNotificationAction,
} from "@/lib/notifications/queries";
import {
  getNotificationTargetPath,
  getWorkspacePathPrefix,
} from "@/lib/notifications/notification-targets";

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  normal:   "#3b82f6",
  low:      "var(--cs-text-subtle)",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high:     "High",
  normal:   "Normal",
  low:      "Low",
};

function typeLabel(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function computeHref(n: WorkspaceNotification): string | null {
  if (!n.action_href) return null;

  // Safety: if the stored href does not match the notification's target workspace,
  // compute a fallback from entity metadata so users are never routed to the wrong workspace.
  const ws = n.target_workspace as
    | "owner"
    | "manager"
    | "crm"
    | "staff-portal"
    | "driver"
    | "utility"
    | undefined;
  if (ws) {
    const prefix = getWorkspacePathPrefix(ws);
    if (!n.action_href.startsWith(prefix)) {
      return getNotificationTargetPath({
        workspace: ws,
        entityType: n.entity_type,
        entityId: n.entity_id,
      });
    }
  }

  return n.action_href;
}

type Props = {
  notification: WorkspaceNotification;
  onMarkRead?: () => void;
  onDismiss?: () => void;
};

export function NotificationCard({ notification: n, onMarkRead, onDismiss }: Props) {
  const [, startTransition] = useTransition();
  const isUnread = n.status === "unread";
  const href = computeHref(n);

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
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--cs-text-subtle)",
          }}>
            {typeLabel(n.type)}
          </span>
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: PRIORITY_DOT[n.priority] ?? PRIORITY_DOT.normal,
            background: "var(--cs-surface-warm)",
            borderRadius: "9999px",
            padding: "1px 6px",
          }}>
            {PRIORITY_LABEL[n.priority] ?? n.priority}
          </span>
          {n.requires_action && (
            <span style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: "#991b1b",
              background: "#fee2e2",
              borderRadius: "9999px",
              padding: "1px 6px",
            }}>
              Action required
            </span>
          )}
        </div>

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
          {href && (
            <Link
              href={href}
              onClick={isUnread ? handleMarkRead : undefined}
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
