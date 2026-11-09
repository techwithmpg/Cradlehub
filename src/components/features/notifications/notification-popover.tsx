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
import { NotificationSettingsDialog } from "./notification-settings-dialog";

type Props = {
  items: WorkspaceNotification[];
  roleHref: string;
  unreadCount: number;
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
  role: string;
  smartPendingBookings?: boolean;
  pendingCrmCount?: number | null;
};

const SETTINGS_ROLES = new Set(["owner", "crm", "staff", "driver", "utility"]);

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
  role,
  smartPendingBookings = false,
  pendingCrmCount = null,
}: Props) {
  const [markingAll, setMarkingAll] = useState(false);
  const orderedItems = sortNewestFirst(items);
  // Only the authenticated, on-duty CRM queue count can decide when to
  // show one grouped doorway. Notification rows are historical signals, not
  // the authoritative current booking count.
  const groupedPendingCount =
    smartPendingBookings && role === "crm" && typeof pendingCrmCount === "number" &&
    Number.isSafeInteger(pendingCrmCount) && pendingCrmCount > 1
      ? pendingCrmCount
      : 0;
  const hasPendingGroup = groupedPendingCount > 1;
  const bookingReviewItems = hasPendingGroup
    ? orderedItems.filter((item) =>
        item.target_workspace === "crm" &&
        item.type === "booking_created" &&
        item.requires_action &&
        (item.status === "unread" || item.status === "read")
      )
    : [];
  const groupedBookingIds = new Set(bookingReviewItems.map((item) => item.id));
  const displayedItems = orderedItems.filter((item) => !groupedBookingIds.has(item.id));
  const hasUnread = unreadCount > 0;
  const hasMarkableUnread = orderedItems.some(
    (item) => item.status === "unread" && !item.requires_action
  );

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsReadAction(role === "owner");
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

        {hasMarkableUnread ? (
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
        ) : displayedItems.length === 0 && !hasPendingGroup ? (
          <CrmEmptyState
            title="No notifications yet"
            description="New bookings, setup alerts, and staff updates will appear here."
            icon={Bell}
            className="px-6 py-10"
          />
        ) : (
          <div>
            {hasPendingGroup ? (
              <Link
                href="/crm/bookings?tab=needs-action"
                className="flex items-center gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-sand-mist)] px-4 py-3 text-sm text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)]"
              >
                <Bell className="size-5 shrink-0 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                <span className="flex-1">
                  <strong className="block">{groupedPendingCount} bookings awaiting confirmation</strong>
                  <span className="block text-xs text-[var(--cs-text-secondary)]">
                    Open the current pending queue. Individual notices stay preserved.
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : null}
            {displayedItems.map((item) => (
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
        {SETTINGS_ROLES.has(role) ? (
          <div className="mb-2">
            <NotificationSettingsDialog role={role} />
          </div>
        ) : null}
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
