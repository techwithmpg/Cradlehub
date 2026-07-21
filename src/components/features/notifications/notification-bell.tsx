"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getRecentNotificationsAction,
  getUnreadCountAction,
  dismissNotificationAction,
} from "@/lib/notifications/queries";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationBellDropdown } from "./notification-bell-dropdown";
import { BookingNotificationSound } from "./booking-notification-sound";
import { canonicalizeSystemRole } from "@/constants/staff";
import { getNotificationDisplay } from "./notification-display";
import { dispatchBookingNotificationSound } from "./notification-sound-preference";
import {
  broadcastNotificationReconciliation,
  useWorkspaceNotificationRealtime,
} from "./use-workspace-notification-realtime";

// Roles that handle booking payments and should hear actionable-booking sounds.
const SOUND_ROLES = new Set(["crm", "manager", "owner"]);

const WORKSPACE_HREF: Record<string, string> = {
  owner: "/owner/notifications",
  manager: "/manager",
  crm: "/crm/notifications",
  staff: "/staff-portal/notifications",
  driver: "/driver",
  utility: "/utility",
};

const BOOKING_NOTIFICATION_TYPES = new Set([
  "booking_created",
  "booking_assigned",
  "home_service_assigned",
  "booking_cancelled",
  "booking_rescheduled",
  "booking_reassigned",
  "booking_status_changed",
  "customer_arrived",
  "payment_pending",
  "payment_overdue",
  "home_service_dispatch_conflict",
  "home_service_location_review",
  "staff_schedule_exception",
]);

function isBookingNotification(notification: WorkspaceNotification) {
  return (
    notification.entity_type === "booking" ||
    BOOKING_NOTIFICATION_TYPES.has(notification.type)
  );
}

export function NotificationBell({ role }: { role: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const knownIdsRef = useRef(new Set<string>());

  const canonicalRole = canonicalizeSystemRole(role);
  const href = WORKSPACE_HREF[canonicalRole] ?? "/owner/notifications";

  const refreshNotifications = useCallback(async () => {
    setFetching(true);
    try {
      const [notifications, unreadCount] = await Promise.all([
        getRecentNotificationsAction(20),
        getUnreadCountAction(),
      ]);
      knownIdsRef.current = new Set(notifications.map((notification) => notification.id));
      setItems(notifications);
      setCount(unreadCount);
    } catch {
      setItems([]);
    } finally {
      setFetching(false);
    }
  }, []);

  // Establish the initial unread baseline without presenting old rows as alerts.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshNotifications]);

  const handleRealtimeInsert = useCallback(
    (
      notification: WorkspaceNotification,
      { present }: { present: boolean }
    ) => {
      if (!present) {
        const alreadyKnown = knownIdsRef.current.has(notification.id);
        knownIdsRef.current.add(notification.id);
        setItems((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, 20));
        if (!alreadyKnown && notification.status === "unread") {
          setCount((current) => current + 1);
        }
        return;
      }

      const display = getNotificationDisplay(notification);
      const description = [notification.body?.trim() || display.detail, display.meta]
        .filter(Boolean)
        .join(" · ");
      toast(notification.title || display.title, {
        description,
        duration:
          notification.priority === "critical"
            ? 15_000
            : notification.priority === "high"
              ? 10_000
              : 7_000,
        action: {
          label: display.actionLabel,
          onClick: () => router.push(display.href),
        },
        cancel: {
          label: "Dismiss",
          onClick: () => {
            void dismissNotificationAction(notification.id).finally(() => {
              broadcastNotificationReconciliation();
              void refreshNotifications();
            });
          },
        },
      });

      if (isBookingNotification(notification)) {
        dispatchBookingNotificationSound(notification.id);
      }
    },
    [refreshNotifications, router]
  );

  const handleRealtimeUpdate = useCallback(
    (notification: WorkspaceNotification) => {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? notification : item
        )
      );
      void getUnreadCountAction().then(setCount).catch(() => {});
    },
    []
  );

  useWorkspaceNotificationRealtime({
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onReconcile: refreshNotifications,
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        void refreshNotifications();
      }
    },
    [refreshNotifications]
  );

  const remove = useCallback((id: string) => {
    const target = items.find((item) => item.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (target?.status === "unread") {
      setCount((current) => Math.max(0, current - 1));
    }
  }, [items]);

  const markRead = useCallback((id: string) => {
    const target = items.find((item) => item.id === id);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "read" as const } : item
      )
    );
    if (target?.status === "unread") {
      setCount((current) => Math.max(0, current - 1));
    }
    broadcastNotificationReconciliation();
  }, [items]);

  const markAllRead = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "unread" ? { ...item, status: "read" as const } : item
      )
    );
    setCount(0);
    broadcastNotificationReconciliation();
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div data-notification-bell className="relative shrink-0">
        {SOUND_ROLES.has(canonicalRole) && <BookingNotificationSound />}

        <PopoverTrigger
          aria-expanded={open}
          aria-label={
            count > 0
              ? `${count} unread notification${count === 1 ? "" : "s"}`
              : "Notifications"
          }
          title={
            count > 0
              ? `${count} unread notification${count === 1 ? "" : "s"}`
              : "Notifications"
          }
          className={cn(
            "relative flex size-[30px] shrink-0 items-center justify-center rounded-[var(--cs-r-xs)] border-0 bg-transparent text-[var(--cs-text-muted)] transition-colors",
            "hover:bg-[var(--cs-surface-raised)] hover:text-[var(--cs-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30",
            open && "bg-[var(--cs-surface-raised)] text-[var(--cs-text)]",
            count > 0 && "text-[var(--cs-text)]"
          )}
        >
          <Bell className="size-4" aria-hidden="true" />

          {count > 0 ? (
            <span className="absolute right-px top-px flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--cs-sand)] px-1 text-[9px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="!w-[calc(100vw-2rem)] !max-w-[420px] gap-0 overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-0 text-[var(--cs-text)] shadow-[var(--cs-shadow-lg)] ring-0 sm:!w-[420px]"
        >
          <NotificationBellDropdown
            items={items}
            roleHref={href}
            unreadCount={count}
            isLoading={fetching}
            onMarkRead={markRead}
            onDismiss={remove}
            onMarkAllRead={markAllRead}
            role={canonicalRole}
          />
        </PopoverContent>
      </div>
    </Popover>
  );
}
