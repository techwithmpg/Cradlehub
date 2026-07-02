"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getRecentNotificationsAction,
  getUnreadCountAction,
} from "@/lib/notifications/queries";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { NotificationBellDropdown } from "./notification-bell-dropdown";
import { BookingNotificationSound } from "./booking-notification-sound";
import { canonicalizeSystemRole } from "@/constants/staff";

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

export function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const canonicalRole = canonicalizeSystemRole(role);
  const href = WORKSPACE_HREF[canonicalRole] ?? "/owner/notifications";

  const refreshNotifications = useCallback(async () => {
    setFetching(true);
    try {
      const [notifications, unreadCount] = await Promise.all([
        getRecentNotificationsAction(20),
        getUnreadCountAction(),
      ]);
      setItems(notifications);
      setCount(unreadCount);
    } catch {
      setItems([]);
    } finally {
      setFetching(false);
    }
  }, []);

  // Initial badge count
  useEffect(() => {
    getUnreadCountAction().then(setCount).catch(() => {});
  }, []);

  // Refresh badge count periodically when closed; pause while the tab is hidden.
  useEffect(() => {
    if (open) return;

    const poll = () => {
      getUnreadCountAction().then(setCount).catch(() => {});
    };
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      id = setInterval(poll, 60_000);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      poll();
      start();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [open]);

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
  }, [items]);

  const markAllRead = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "unread" ? { ...item, status: "read" as const } : item
      )
    );
    setCount(0);
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
          />
        </PopoverContent>
      </div>
    </Popover>
  );
}
