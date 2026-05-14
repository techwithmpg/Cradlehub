"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { markAllNotificationsReadAction } from "@/lib/notifications/queries";

type Props = {
  notifications: WorkspaceNotification[];
};

export function TodayAttentionStrip({ notifications }: Props) {
  const [items, setItems] = useState(notifications);
  const [marking, setMarking] = useState(false);

  if (!items.length) return null;

  const titles = items.slice(0, 2).map((n) => n.title);
  const remaining = Math.max(0, items.length - titles.length);

  async function handleMarkAllSeen() {
    setMarking(true);
    try {
      await markAllNotificationsReadAction();
      setItems((prev) => prev.map((n) => ({ ...n, status: "read" as const })));
    } finally {
      setMarking(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        padding: "10px 14px",
        borderRadius: "var(--cs-r-md)",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--cs-sand)",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--cs-text)",
          flex: 1,
          minWidth: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {items.length} action item{items.length === 1 ? "" : "s"} need attention
        </span>
        {titles.length > 0 && (
          <span style={{ color: "var(--cs-text-muted)", marginLeft: 6 }}>
            {titles.join(" · ")}
            {remaining > 0 && ` + ${remaining} more`}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <Link
          href="/crm/notifications"
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--cs-brand)",
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: "var(--cs-r-sm)",
            background: "var(--cs-sand-mist)",
          }}
        >
          Review
        </Link>
        <button
          type="button"
          onClick={handleMarkAllSeen}
          disabled={marking || !items.some((n) => n.status === "unread")}
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--cs-text-muted)",
            background: "none",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-sm)",
            padding: "4px 10px",
            cursor: marking ? "wait" : "pointer",
            opacity: marking ? 0.6 : 1,
          }}
        >
          {marking ? "Marking…" : "Mark all seen"}
        </button>
      </div>
    </div>
  );
}
