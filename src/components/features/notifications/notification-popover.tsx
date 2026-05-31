"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CrmEmptyState } from "@/components/features/crm/premium/crm-empty-state";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { markAllNotificationsReadAction } from "@/lib/notifications/queries";
import { NotificationPopoverRow } from "./notification-popover-row";

type Props = {
  items: WorkspaceNotification[];
  roleHref: string;
  unreadCount: number;
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
};

function sortNewestFirst(items: WorkspaceNotification[]): WorkspaceNotification[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function NotificationSkeletonRows() {
  return (
    <div className="space-y-0" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex gap-3 border-b border-[var(--cs-border-soft)] px-3 py-3 last:border-b-0"
        >
          <Skeleton className="size-9 shrink-0 rounded-full bg-[var(--cs-surface-warm)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-32 bg-[var(--cs-surface-warm)]" />
              <Skeleton className="h-3 w-10 bg-[var(--cs-surface-warm)]" />
            </div>
            <Skeleton className="h-3 w-full bg-[var(--cs-surface-warm)]" />
            <Skeleton className="h-3 w-2/3 bg-[var(--cs-surface-warm)]" />
            <Skeleton className="h-7 w-24 rounded-lg bg-[var(--cs-surface-warm)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationPopover({
  items,
  roleHref,
  unreadCount,
  isLoading,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
}: Props) {
  const [markingAll, setMarkingAll] = useState(false);
  const orderedItems = sortNewestFirst(items);
  const hasUnread = unreadCount > 0;

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsReadAction();
      onMarkAllRead();
    } catch {
      toast.error("Could not mark notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="flex max-h-[calc(100dvh-5.5rem)] min-h-[18rem] flex-col overflow-hidden sm:max-h-[520px]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-sm font-bold text-[var(--cs-text)]">
              Notifications
            </h2>
            {hasUnread ? (
              <Badge
                variant="outline"
                className="h-5 border-[var(--cs-border-soft)] bg-[var(--cs-sand-mist)] px-2 text-[0.6875rem] font-bold text-[var(--cs-sand-dark)]"
              >
                {unreadCount > 99 ? "99+" : unreadCount} unread
              </Badge>
            ) : null}
          </div>
        </div>

        {hasUnread ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleMarkAll}
            disabled={markingAll}
            className="h-7 text-[0.6875rem] font-semibold text-[var(--cs-sand-dark)] hover:bg-[var(--cs-sand-mist)] hover:text-[var(--cs-sand-dark)]"
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        ) : null}
      </header>

      <ScrollArea
        className="min-h-0 flex-1 bg-[var(--cs-surface)]"
        role={isLoading ? "status" : undefined}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <NotificationSkeletonRows />
        ) : orderedItems.length === 0 ? (
          <CrmEmptyState
            title="No notifications yet"
            description="New bookings, setup alerts, and staff updates will appear here."
            icon={Bell}
            className="px-6 py-10"
          />
        ) : (
          <div>
            {orderedItems.map((item) => (
              <NotificationPopoverRow
                key={item.id}
                notification={item}
                onMarkRead={() => onMarkRead(item.id)}
                onDismiss={() => onDismiss(item.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <footer className="shrink-0 border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-3">
        <Link
          href={roleHref}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text-secondary)] transition hover:border-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)] hover:text-[var(--cs-sand-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30"
        >
          View all notifications
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
