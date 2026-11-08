"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { getNotificationBellSnapshot } from "@/lib/notifications/queries";
import { shouldPresentActionPopup } from "@/lib/notifications/presentation-policy";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationBellDropdown } from "./notification-bell-dropdown";
import { BookingNotificationSound } from "./booking-notification-sound";
import { canonicalizeSystemRole } from "@/constants/staff";
import { getNotificationDisplay } from "./notification-display";
import { dispatchBookingNotificationSound } from "./notification-sound-preference";
import {
  notificationUnreadDelta,
  upsertNotificationItems,
} from "@/lib/notifications/notification-state";
import {
  broadcastNotificationReconciliation,
  useWorkspaceNotificationRealtime,
} from "./use-workspace-notification-realtime";

// Roles that handle booking payments and should hear actionable-booking sounds.
const SOUND_ROLES = new Set(["crm", "manager"]);

const WORKSPACE_HREF: Record<string, string> = {
  owner: "/owner/notifications",
  digital_marketer: "/marketing",
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
  if (serviceTransitionEventId(notification)) return false;
  return (
    notification.entity_type === "booking" || BOOKING_NOTIFICATION_TYPES.has(notification.type)
  );
}

function serviceTransitionEventId(notification: WorkspaceNotification): string | null {
  const metadata = notification.metadata;
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const id = metadata.service_transition_event_id;
  return typeof id === "string" ? id : null;
}

export function NotificationBell({ role, userId, toastOnly = false }: { role: string; userId?: string; toastOnly?: boolean }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const knownIdsRef = useRef(new Set<string>());
  const knownStatusRef = useRef(new Map<string, WorkspaceNotification["status"]>());
  const deferredRef = useRef(new Map<string, WorkspaceNotification>());
  const shownToastRef = useRef<string | null>(null);
  const displayedToastIdsRef = useRef(new Set<string>());

  const canonicalRole = canonicalizeSystemRole(role);
  const ownerOnly = canonicalRole === "owner";
  const presentationScope = `${userId ?? "anonymous"}:${canonicalRole}`;
  const href = WORKSPACE_HREF[canonicalRole] ?? "/owner/notifications";

  const refreshNotifications = useCallback(async () => {
    setFetching(true);
    try {
      const snapshot = await getNotificationBellSnapshot(20, ownerOnly);
      knownIdsRef.current = new Set(snapshot.items.map((notification) => notification.id));
      knownStatusRef.current = new Map(
        snapshot.items.map((notification) => [notification.id, notification.status])
      );
      setItems(snapshot.items);
      setCount(snapshot.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setFetching(false);
    }
  }, [ownerOnly]);

  // Establish the initial unread baseline without presenting old rows as alerts.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshNotifications]);

  // A payment form, focused input or open workflow dialog has priority over
  // informational popups. Pending action remains visible in the bell.
  const isSafePresentationMoment = useCallback(() => {
    if (document.visibilityState !== "visible") return false;
    if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
      return false;
    }
    const active = document.activeElement;
    return !(active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && active.isContentEditable));
  }, []);

  const showActionPopup = useCallback((notification: WorkspaceNotification) => {
    const display = getNotificationDisplay(notification);
    const description = [notification.body?.trim() || display.detail, display.meta]
      .filter(Boolean)
      .join(" · ");
    shownToastRef.current = notification.id;
    displayedToastIdsRef.current.add(notification.id);
    const release = () => {
      if (shownToastRef.current === notification.id) shownToastRef.current = null;
    };
    toast(notification.title || display.title, {
      id: notification.id,
      description,
      duration: notification.priority === "critical" ? 15_000 : 10_000,
      action: {
        label: display.actionLabel,
        onClick: () => {
          toast.dismiss(notification.id);
          router.push(display.href);
        },
      },
      // Close affects this desktop popup only; it must not dismiss the
      // shared branch notification or resolve any underlying work.
      cancel: {
        label: "Close",
        onClick: () => toast.dismiss(notification.id),
      },
      onDismiss: release,
      onAutoClose: release,
    });
    if (isBookingNotification(notification)) {
      dispatchBookingNotificationSound(notification.id);
    }
  }, [router]);

  const flushDeferred = useCallback(() => {
    if (!isSafePresentationMoment() || shownToastRef.current) return;
    for (const [id, notification] of deferredRef.current) {
      deferredRef.current.delete(id);
      // Another CSR might have already resolved it while this user was busy.
      if (knownStatusRef.current.get(id) !== "unread") continue;
      showActionPopup(notification);
      break;
    }
  }, [isSafePresentationMoment, showActionPopup]);

  useEffect(() => {
    const onIdle = () => window.setTimeout(flushDeferred, 0);
    const interval = window.setInterval(flushDeferred, 2_000);
    document.addEventListener("focusout", onIdle);
    document.addEventListener("visibilitychange", onIdle);
    window.addEventListener("focus", onIdle);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("focusout", onIdle);
      document.removeEventListener("visibilitychange", onIdle);
      window.removeEventListener("focus", onIdle);
    };
  }, [flushDeferred]);

  useEffect(() => {
    return () => {
      // Never leave a previous account's popup visible after the bell unmounts.
      deferredRef.current.clear();
      for (const id of displayedToastIdsRef.current) toast.dismiss(id);
      displayedToastIdsRef.current.clear();
      shownToastRef.current = null;
    };
  }, [presentationScope]);

  const handleRealtimeInsert = useCallback(
    (notification: WorkspaceNotification, { present }: { present: boolean }) => {
      if (ownerOnly && notification.target_workspace !== "owner") return;
      if (notification.status === "resolved" || notification.status === "dismissed") return;
      if (!present) {
        const alreadyKnown = knownIdsRef.current.has(notification.id);
        knownIdsRef.current.add(notification.id);
        knownStatusRef.current.set(notification.id, notification.status);
        setItems((current) => upsertNotificationItems(current, notification));
        if (!alreadyKnown && notification.status === "unread") {
          setCount((current) => current + 1);
        }
        // All authorized tabs need the booking refresh, even when another
        // tab owns the single visible popup presentation.
        if (serviceTransitionEventId(notification)) notifyBookingsChanged();
        return;
      }

      // Service transition presentation belongs to the existing service
      // lifecycle provider; keep booking refresh but avoid a duplicate toast.
      if (serviceTransitionEventId(notification)) return;
      if (!shouldPresentActionPopup(notification)) return;
      if (knownStatusRef.current.get(notification.id) !== "unread") return;

      if (!isSafePresentationMoment() || shownToastRef.current) {
        deferredRef.current.set(notification.id, notification);
        return;
      }
      showActionPopup(notification);
    },
    [ownerOnly, isSafePresentationMoment, showActionPopup]
  );

  const handleRealtimeUpdate = useCallback((notification: WorkspaceNotification) => {
    if (ownerOnly && notification.target_workspace !== "owner") return;
    const previousStatus = knownStatusRef.current.get(notification.id);
    knownStatusRef.current.set(notification.id, notification.status);
    if (previousStatus === undefined) {
      // Rows outside the 20 visible items may still contribute to the unread
      // total. Reconcile instead of guessing the badge delta.
      void refreshNotifications();
    }
    if (notification.status === "resolved" || notification.status === "dismissed") {
      deferredRef.current.delete(notification.id);
      displayedToastIdsRef.current.delete(notification.id);
      toast.dismiss(notification.id);
    }
    setItems((current) =>
      notification.status === "resolved" || notification.status === "dismissed"
        ? current.filter((item) => item.id !== notification.id)
        : current.some((item) => item.id === notification.id)
          ? upsertNotificationItems(current, notification)
          : current
    );
    const delta = notificationUnreadDelta(previousStatus, notification.status);
    if (delta !== 0) setCount((current) => Math.max(0, current + delta));
  }, [ownerOnly, refreshNotifications]);

  useWorkspaceNotificationRealtime({
    presentationScope,
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

  const remove = useCallback(
    (id: string) => {
      const target = items.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (target?.status === "unread") {
        setCount((current) => Math.max(0, current - 1));
      }
      knownStatusRef.current.set(id, "dismissed");
    },
    [items]
  );

  const markRead = useCallback(
    (id: string) => {
      const target = items.find((item) => item.id === id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "read" as const } : item))
      );
      if (target?.status === "unread") {
        setCount((current) => Math.max(0, current - 1));
      }
      knownStatusRef.current.set(id, "read");
      broadcastNotificationReconciliation(presentationScope);
    },
    [items, presentationScope]
  );

  const markAllRead = useCallback(() => {
    // The server only marks informational updates read. Never optimistically
    // clear the action-required unread count for other CSR users.
    void refreshNotifications();
    broadcastNotificationReconciliation(presentationScope);
  }, [presentationScope, refreshNotifications]);

  if (toastOnly) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div data-notification-bell className="relative shrink-0">
        {SOUND_ROLES.has(canonicalRole) && <BookingNotificationSound />}

        <PopoverTrigger
          aria-expanded={open}
          aria-label={
            count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"
          }
          title={
            count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"
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
