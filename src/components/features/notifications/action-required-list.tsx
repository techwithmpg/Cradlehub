import Link from "next/link";
import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import {
  getNotificationTargetPath,
  getWorkspacePathPrefix,
} from "@/lib/notifications/notification-targets";
import type { WorkspaceNotification } from "@/lib/notifications/types";

function hrefForNotification(notification: WorkspaceNotification): string {
  if (notification.action_href) return notification.action_href;
  const workspace =
    notification.target_workspace === "staff"
      ? "staff-portal"
      : notification.target_workspace;
  const prefix = getWorkspacePathPrefix(
    workspace as "owner" | "manager" | "crm" | "staff-portal" | "driver" | "utility"
  );
  return getNotificationTargetPath({
    workspace: workspace as "owner" | "manager" | "crm" | "staff-portal" | "driver" | "utility",
    entityType: notification.entity_type,
    entityId: notification.entity_id,
  }) || prefix;
}

export async function ActionRequiredList({ limit = 5 }: { limit?: number }) {
  const notifications = await getActionRequiredNotificationsAction(limit);
  if (!notifications.length) return null;

  const titles = notifications.slice(0, 2).map((n) => n.title);
  const remaining = Math.max(0, notifications.length - titles.length);
  const reviewHref = hrefForNotification(notifications[0]!);

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
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--cs-text)", flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{notifications.length} action item{notifications.length === 1 ? "" : "s"} need attention</span>
        {titles.length > 0 && (
          <span style={{ color: "var(--cs-text-muted)", marginLeft: 6 }}>
            {titles.join(" · ")}
            {remaining > 0 && ` + ${remaining} more`}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Link
          href={reviewHref}
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
      </div>
    </div>
  );
}
