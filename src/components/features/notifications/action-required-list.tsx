import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import { NotificationListClient } from "./notification-list-client";

export async function ActionRequiredList({ limit = 5 }: { limit?: number }) {
  const notifications = await getActionRequiredNotificationsAction(limit);
  if (!notifications.length) return null;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{
        display:       "flex",
        alignItems:    "center",
        gap:           6,
        marginBottom:  8,
      }}>
        <div style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   "#ef4444",
          flexShrink:   0,
        }} />
        <span style={{
          fontSize:   12,
          fontWeight: 600,
          color:      "var(--cs-text)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          Action Required
        </span>
        <span style={{
          fontSize:     10.5,
          fontWeight:   600,
          color:        "#fff",
          background:   "#ef4444",
          borderRadius: "9999px",
          padding:      "1px 6px",
          lineHeight:   1.5,
        }}>
          {notifications.length}
        </span>
      </div>
      <NotificationListClient initialNotifications={notifications} />
    </div>
  );
}
