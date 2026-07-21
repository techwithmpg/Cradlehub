"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { WorkspaceNotification } from "@/lib/notifications/types";

const CHANNEL_NAME = "cradlehub-workspace-notifications";
const SESSION_HANDLED_KEY = "cradlehub_notification_session_ids";
const BROWSER_HANDLED_KEY = "cradlehub_notification_browser_ids";
const RECONCILE_INTERVAL_MS = 5 * 60_000;
const MAX_HANDLED_IDS = 200;
const OLD_INSERT_TOLERANCE_MS = 10_000;

type RealtimeInsertContext = {
  present: boolean;
};

type NotificationChannelMessage =
  | { type: "handled"; notificationId: string }
  | { type: "reconcile" };

type UseWorkspaceNotificationRealtimeInput = {
  onInsert: (
    notification: WorkspaceNotification,
    context: RealtimeInsertContext
  ) => void;
  onUpdate: (notification: WorkspaceNotification) => void;
  onReconcile: () => void;
};

function readIds(storage: Storage, key: string): Set<string> {
  try {
    const value = storage.getItem(key);
    const ids = value ? (JSON.parse(value) as unknown) : [];
    return new Set(
      Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string").slice(-MAX_HANDLED_IDS)
        : []
    );
  } catch {
    return new Set();
  }
}

function writeIds(storage: Storage, key: string, ids: Set<string>) {
  try {
    storage.setItem(key, JSON.stringify([...ids].slice(-MAX_HANDLED_IDS)));
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

function isWorkspaceNotification(value: unknown): value is WorkspaceNotification {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WorkspaceNotification>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.type === "string" &&
    typeof row.status === "string" &&
    typeof row.created_at === "string"
  );
}

function isFreshInsert(notification: WorkspaceNotification, mountedAt: number) {
  const createdAt = new Date(notification.created_at).getTime();
  return Number.isFinite(createdAt) && createdAt >= mountedAt - OLD_INSERT_TOLERANCE_MS;
}

export function useWorkspaceNotificationRealtime({
  onInsert,
  onUpdate,
  onReconcile,
}: UseWorkspaceNotificationRealtimeInput) {
  const callbacksRef = useRef({ onInsert, onUpdate, onReconcile });

  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onReconcile };
  }, [onInsert, onReconcile, onUpdate]);

  useEffect(() => {
    const mountedAt = Date.now();
    const handledInTab = readIds(sessionStorage, SESSION_HANDLED_KEY);
    const supabase = createClient();
    const coordinationChannel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CHANNEL_NAME);
    let subscribedOnce = false;
    let disposed = false;

    const rememberInTab = (notificationId: string) => {
      handledInTab.add(notificationId);
      writeIds(sessionStorage, SESSION_HANDLED_KEY, handledInTab);
    };

    const claimVisiblePresentation = async (
      notification: WorkspaceNotification
    ) => {
      if (document.visibilityState !== "visible") {
        rememberInTab(notification.id);
        return;
      }

      const claim = () => {
        if (handledInTab.has(notification.id)) return;

        const browserHandled = readIds(localStorage, BROWSER_HANDLED_KEY);
        if (browserHandled.has(notification.id)) {
          rememberInTab(notification.id);
          return;
        }

        browserHandled.add(notification.id);
        writeIds(localStorage, BROWSER_HANDLED_KEY, browserHandled);
        rememberInTab(notification.id);
        coordinationChannel?.postMessage({
          type: "handled",
          notificationId: notification.id,
        } satisfies NotificationChannelMessage);
        callbacksRef.current.onInsert(notification, { present: true });
      };

      if ("locks" in navigator && navigator.locks) {
        await navigator.locks.request(
          `cradlehub-notification:${notification.id}`,
          claim
        );
        return;
      }

      claim();
    };

    coordinationChannel?.addEventListener("message", (event) => {
      const message = event.data as NotificationChannelMessage;
      if (message?.type === "handled" && typeof message.notificationId === "string") {
        rememberInTab(message.notificationId);
      } else if (message?.type === "reconcile") {
        callbacksRef.current.onReconcile();
      }
    });

    const channel = supabase
      .channel(`workspace-notifications-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_notifications",
        },
        (payload) => {
          if (!isWorkspaceNotification(payload.new)) return;

          // Postgres Changes applies the table's SELECT RLS policy before this
          // authenticated browser receives the row. The timestamp guard also
          // prevents an old unread row from being presented as a new alert.
          if (!isFreshInsert(payload.new, mountedAt)) {
            rememberInTab(payload.new.id);
            callbacksRef.current.onReconcile();
            return;
          }

          callbacksRef.current.onInsert(payload.new, { present: false });
          void claimVisiblePresentation(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspace_notifications",
        },
        (payload) => {
          if (isWorkspaceNotification(payload.new)) {
            callbacksRef.current.onUpdate(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (disposed || status !== "SUBSCRIBED") return;
        if (subscribedOnce) callbacksRef.current.onReconcile();
        subscribedOnce = true;
      });

    const reconcile = () => {
      if (document.visibilityState === "visible") {
        callbacksRef.current.onReconcile();
      }
    };
    const timer = window.setInterval(reconcile, RECONCILE_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "CRADLEHUB_PUSH_RECONCILE") reconcile();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
      coordinationChannel?.close();
      void supabase.removeChannel(channel);
    };
  }, []);
}

export function broadcastNotificationReconciliation() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "reconcile" } satisfies NotificationChannelMessage);
  channel.close();
}
