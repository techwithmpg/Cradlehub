import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import type { WorkflowTask } from "@/lib/notifications/types";
import { NotificationPriorityBadge } from "./notification-priority-badge";

export function InlineWorkflowTaskCard({ task }: { task: WorkflowTask }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "0.75rem",
        marginBottom: "0.875rem",
        borderRadius: "var(--cs-r-sm)",
        background: "var(--cs-sand-mist)",
        border: "1px solid rgba(200,169,107,0.28)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--cs-r-xs)",
          background: "rgba(200,169,107,0.18)",
          color: "var(--cs-sand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ClipboardCheck size={15} aria-hidden="true" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text)" }}>
            {task.title}
          </span>
          <NotificationPriorityBadge priority={task.priority} />
        </div>
        {task.body && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
            {task.body}
          </p>
        )}
      </div>

      {task.action_href && (
        <Link
          href={task.action_href}
          style={{
            flexShrink: 0,
            color: "var(--cs-brand)",
            fontSize: "0.75rem",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open
        </Link>
      )}
    </div>
  );
}
