"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Check,
  CircleDollarSign,
  Info,
  Settings,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import {
  dismissNotificationAction,
  markNotificationReadAction,
} from "@/lib/notifications/queries";
import {
  getNotificationDisplay,
  type NotificationDisplay,
  type NotificationTone,
} from "./notification-display";

const TONE_CLASSES: Record<NotificationTone, string> = {
  booking: "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  payment: "bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]",
  staff: "bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]",
  setup: "bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]",
  schedule: "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
  waitlist: "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  warning: "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
  info: "bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]",
  success: "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
};

const UNREAD_DOT_CLASSES: Record<string, string> = {
  critical: "bg-[var(--cs-error)]",
  high: "bg-[var(--cs-warning-text)]",
  normal: "bg-[var(--cs-sand)]",
  low: "bg-[var(--cs-text-subtle)]",
};

function DisplayIcon({ display }: { display: NotificationDisplay }) {
  const iconClassName = "size-4";
  const Icon =
    display.iconName === "calendar"
      ? CalendarCheck
      : display.iconName === "payment"
        ? CircleDollarSign
        : display.iconName === "user"
          ? UserRound
          : display.iconName === "settings"
            ? Settings
            : display.iconName === "warning"
              ? TriangleAlert
              : display.iconName === "users"
                ? UsersRound
                : Info;

  return (
    <span
      className={cn(
        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
        TONE_CLASSES[display.tone]
      )}
      aria-hidden="true"
    >
      <Icon className={iconClassName} />
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type Props = {
  notification: WorkspaceNotification;
  onMarkRead: () => void;
  onDismiss: () => void;
};

export function NotificationPopoverRow({
  notification,
  onMarkRead,
  onDismiss,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDismissing, setIsDismissing] = useState(false);
  const display = getNotificationDisplay(notification);
  const isUnread = notification.status === "unread";
  const unreadDotClass = UNREAD_DOT_CLASSES[notification.priority] ?? UNREAD_DOT_CLASSES.normal;

  function handleOpen() {
    startTransition(async () => {
      if (isUnread) {
        try {
          await markNotificationReadAction(notification.id);
          onMarkRead();
        } catch {
          toast.error("Could not mark notification as read.");
        }
      }
      router.push(display.href);
    });
  }

  function handleMarkRead(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!isUnread) return;

    startTransition(async () => {
      try {
        await markNotificationReadAction(notification.id);
        onMarkRead();
      } catch {
        toast.error("Could not mark notification as read.");
      }
    });
  }

  async function handleDismiss(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setIsDismissing(true);
    try {
      await dismissNotificationAction(notification.id);
      onDismiss();
    } catch {
      toast.error("Could not dismiss notification.");
      setIsDismissing(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative flex gap-3 border-b border-[var(--cs-border-soft)] px-3 py-3 transition-colors last:border-b-0",
        "hover:bg-[var(--cs-sand-tint)]",
        isUnread ? "bg-[var(--cs-surface-raised)]" : "bg-transparent",
        isPending && "opacity-80"
      )}
    >
      <DisplayIcon display={display} />

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={handleOpen}
          disabled={isPending || isDismissing}
          className="block w-full min-w-0 rounded-md text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30 disabled:cursor-wait"
        >
          <span className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--cs-text)]",
                !isUnread && "font-medium"
              )}
            >
              {display.title}
            </span>
            <span className="shrink-0 pt-0.5 text-[0.6875rem] font-medium text-[var(--cs-text-muted)]">
              {timeAgo(notification.created_at)}
            </span>
          </span>

          <span className="mt-0.5 block text-xs leading-5 text-[var(--cs-text-secondary)]">
            {display.detail}
          </span>

          {display.meta ? (
            <span className="mt-0.5 block text-[0.6875rem] leading-4 text-[var(--cs-text-muted)]">
              {display.meta}
            </span>
          ) : null}
        </button>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpen}
            disabled={isPending || isDismissing}
            className="h-7 border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 text-[0.6875rem] font-semibold text-[var(--cs-sand-dark)] hover:border-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)]"
          >
            {display.actionLabel}
          </Button>

          {isUnread ? (
            <button
              type="button"
              onClick={handleMarkRead}
              disabled={isPending || isDismissing}
              title="Mark read"
              className="inline-flex size-7 items-center justify-center rounded-full text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30 disabled:cursor-wait disabled:opacity-60"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Mark notification as read</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending || isDismissing}
            title="Dismiss"
            className="inline-flex size-7 items-center justify-center rounded-full text-[var(--cs-text-subtle)] transition hover:bg-[var(--cs-error-bg)] hover:text-[var(--cs-error-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30 disabled:cursor-wait disabled:opacity-60"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Dismiss notification</span>
          </button>
        </div>
      </div>

      {isUnread ? (
        <span
          aria-label="Unread notification"
          className={cn("mt-2 size-2 shrink-0 rounded-full", unreadDotClass)}
        />
      ) : null}
    </article>
  );
}
