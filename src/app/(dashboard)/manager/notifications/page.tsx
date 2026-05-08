import { PageHeader } from "@/components/features/dashboard/page-header";
import { getWorkspaceNotificationsAction } from "@/lib/notifications/queries";
import { NotificationListClient } from "@/components/features/notifications/notification-list-client";

export default async function ManagerNotificationsPage() {
  const notifications = await getWorkspaceNotificationsAction(100);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Your branch notifications and action items"
      />

      {notifications.length === 0 ? (
        <div style={{
          padding:      "48px 24px",
          textAlign:    "center",
          color:        "var(--cs-text-muted)",
          fontSize:     13,
          background:   "var(--cs-surface)",
          borderRadius: "var(--cs-r-md)",
          border:       "1px solid var(--cs-border-soft)",
        }}>
          No notifications yet.
        </div>
      ) : (
        <NotificationListClient initialNotifications={notifications} />
      )}
    </div>
  );
}
