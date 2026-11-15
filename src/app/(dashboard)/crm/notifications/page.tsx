import { Bell } from "lucide-react";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";
import { EmptyState } from "@/components/features/crm/shared/crm-workspace-primitives";
import { getWorkspaceNotificationsAction } from "@/lib/notifications/queries";
import { NotificationListClient } from "@/components/features/notifications/notification-list-client";

export default async function CrmNotificationsPage() {
  const notifications = await getWorkspaceNotificationsAction(100);

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="CRM Workspace"
        title="Notifications"
        description="Your workspace notifications and action items"
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications yet"
          detail="Workspace alerts, booking updates, and action items will appear here."
          className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-12"
        />
      ) : (
        <NotificationListClient initialNotifications={notifications} />
      )}
    </div>
  );
}
