"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import {
  markNotificationReadAction,
  dismissNotificationAction,
  respondToAttendanceIssueAction,
} from "@/lib/notifications/queries";
import { resolveNotificationHref } from "@/lib/notifications/notification-targets";

const PRIORITY_DOT: Record<string, string> = {
  critical: "#DC2626",
  high: "#D97706",
  normal: "var(--cs-sand)",
  low: "var(--cs-text-subtle)",
};

const TYPE_ICON: Record<string, string> = {
  staff_onboarding_submitted: "👤",
  staff_onboarding_approved: "✅",
  staff_onboarding_rejected: "❌",
  booking_created: "📅",
  booking_assigned: "📌",
  home_service_assigned: "🏠",
  booking_cancelled: "🚫",
  booking_rescheduled: "🔄",
  booking_reassigned: "🔀",
  booking_status_changed: "📊",
  customer_arrived: "🚪",
  payment_pending: "💳",
  payment_overdue: "⚠️",
  home_service_dispatch_conflict: "🚗",
  home_service_location_review: "📍",
  waitlist_request_submitted: "📝",
  reconciliation_submitted: "📋",
  service_setup_warning: "🔧",
  branch_setup_warning: "🏢",
  resource_conflict_warning: "⚡",
  staff_availability_conflict: "🕐",
  marketing_content_updated: "✨",
  system_warning: "🔔",
  staff_progress_required: "📈",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

type Props = {
  notification: WorkspaceNotification;
  onMarkRead?: () => void;
  onDismiss?: () => void;
};

export function NotificationRow({ notification: n, onMarkRead, onDismiss }: Props) {
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const isUnread = n.status === "unread";
  const href = resolveNotificationHref(n);
  const icon = TYPE_ICON[n.type] ?? "🔔";

  function handleMarkRead(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    startTransition(async () => {
      await markNotificationReadAction(n.id);
      onMarkRead?.();
    });
  }

  function handleDismiss(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    startTransition(async () => {
      await dismissNotificationAction(n.id);
      onDismiss?.();
    });
  }

  function handleAttendanceResponse() {
    startTransition(async () => {
      const result = await respondToAttendanceIssueAction({ notificationId: n.id, response });
      setResponseMessage(result.message);
      if (result.ok) {
        setResponse("");
        onDismiss?.();
      }
    });
  }

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: isUnread ? 600 : 500,
            color: "var(--cs-text)",
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {n.title}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--cs-text-subtle)",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {timeAgo(n.created_at)}
        </span>
      </div>

      {n.body && (
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--cs-text-muted)",
            lineHeight: 1.4,
            marginBottom: 4,
          }}
        >
          {truncate(n.body, 90)}
        </p>
      )}
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--cs-r-sm)",
        background: isUnread ? "var(--cs-surface-raised)" : "transparent",
        borderBottom: "1px solid var(--cs-border-soft)",
        transition: "background 0.15s",
        cursor: href ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--cs-surface-warm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isUnread
          ? "var(--cs-surface-raised)"
          : "transparent";
      }}
    >
      {/* Icon / dot */}
      <div style={{ flexShrink: 0, paddingTop: 1, fontSize: 16 }}>{icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {href ? (
          <Link
            href={href}
            onClick={isUnread ? handleMarkRead : undefined}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            {inner}
          </Link>
        ) : (
          <div style={{ display: "block" }}>{inner}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {n.requires_action && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#92400E",
                background: "#FEF3C7",
                borderRadius: "9999px",
                padding: "1px 6px",
                lineHeight: 1.5,
              }}
            >
              Action required
            </span>
          )}
          {isUnread && (
            <button
              type="button"
              onClick={handleMarkRead}
              style={{
                fontSize: 11,
                color: "var(--cs-text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Mark read
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              fontSize: 11,
              color: "var(--cs-text-subtle)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Dismiss
          </button>
        </div>
        {n.type === "attendance_issue_question" && n.requires_action ? (
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <textarea aria-label="Attendance issue response" value={response} onChange={(event) => setResponse(event.target.value)} maxLength={1000} placeholder="Reply to CRM…" style={{ minHeight: 72, border: "1px solid var(--cs-border)", borderRadius: 8, padding: 8, fontSize: 12 }} />
            <button type="button" disabled={isPending || !response.trim()} onClick={handleAttendanceResponse} style={{ justifySelf: "start", border: 0, borderRadius: 8, padding: "7px 12px", background: "var(--cs-brand)", color: "white", fontWeight: 600, cursor: "pointer" }}>{isPending ? "Sending…" : "Send response"}</button>
            {responseMessage ? <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{responseMessage}</span> : null}
          </div>
        ) : null}
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: PRIORITY_DOT[n.priority] ?? PRIORITY_DOT.normal,
            flexShrink: 0,
            marginTop: 5,
          }}
        />
      )}
    </div>
  );
}
