"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DISMISS_KEY = "cradlehub:push-banner-dismissed";

/**
 * Automatically registers `/cradlehub-push-sw.js` and syncs the browser's Web Push
 * subscription with `/api/notifications/push/subscription` so Staff, Drivers, CRM,
 * and Owners receive background notifications even when the PWA is closed.
 * If permission is "default" (not yet asked), shows a sleek 1-tap activation bar.
 */
export function AutoPushSubscriptionManager() {
  const [needsPermissionPrompt, setNeedsPermissionPrompt] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const syncSubscription = useCallback(async (askPermission: boolean) => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return false;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return false;

    let permission = Notification.permission;
    if (permission === "default" && askPermission) {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      if (permission === "default" && !sessionStorage.getItem(DISMISS_KEY)) {
        setNeedsPermissionPrompt(true);
      } else {
        setNeedsPermissionPrompt(false);
      }
      return false;
    }

    setNeedsPermissionPrompt(false);

    try {
      const registration = await navigator.serviceWorker.register("/cradlehub-push-sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        });
      }

      await fetch("/api/notifications/push/subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncSubscription(false);
    }, 1500);

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "CRADLEHUB_PUSH_SUBSCRIPTION_CHANGED") {
        void syncSubscription(false);
      } else if (
        event.data?.type === "CRADLEHUB_PUSH_RECONCILE" &&
        event.data?.title &&
        window.location.pathname.startsWith("/staff")
      ) {
        const actionHref =
          typeof event.data.actionHref === "string" ? event.data.actionHref : null;
        toast(event.data.title, {
          description: event.data.body,
          duration: 10_000,
          ...(actionHref
            ? {
                action: {
                  label: "Open",
                  onClick: () => {
                    window.location.href = actionHref;
                  },
                },
              }
            : {}),
        });
      }
    };

    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      window.clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [syncSubscription]);

  const handleEnableClick = async () => {
    setSubscribing(true);
    try {
      const ok = await syncSubscription(true);
      if (ok) {
        toast.success("Instant background alerts enabled for this device.");
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (!needsPermissionPrompt) return null;

  return (
    <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-emerald-800/20 bg-emerald-950 px-3.5 py-2.5 text-xs text-white shadow-md">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-800/80 text-amber-300">
          <BellRing className="size-3.5" />
        </span>
        <div>
          <p className="font-semibold leading-tight">Enable Instant Shift & Job Alerts</p>
          <p className="text-[11px] text-emerald-200/80">
            Receive live trip, arrival, and session alerts even when the app is closed.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={subscribing}
          onClick={() => void handleEnableClick()}
          className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-emerald-950 transition hover:bg-amber-300 disabled:opacity-50"
        >
          {subscribing ? "Enabling…" : "Turn On"}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setNeedsPermissionPrompt(false);
          }}
          className="rounded-lg p-1 text-emerald-300/70 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
