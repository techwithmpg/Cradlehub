import { PageHeader } from "@/components/features/dashboard/page-header";
import { getOwnerAllNotificationsAction } from "@/lib/notifications/queries";
import { NotificationListClient } from "@/components/features/notifications/notification-list-client";

export default async function OwnerNotificationsPage() {
  const notifications = await getOwnerAllNotificationsAction(100);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="All workspace notifications across all branches"
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
