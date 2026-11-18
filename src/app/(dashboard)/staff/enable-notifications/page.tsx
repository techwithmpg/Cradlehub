"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActivationState =
  | "checking"
  | "ready"
  | "working"
  | "enabled"
  | "enabled_unverified"
  | "login_required"
  | "unsupported"
  | "ios_install"
  | "blocked"
  | "unavailable"
  | "failed";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

function toKey(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function installedAsApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function errorFrom(response: Response, fallback: string): Promise<string> {
  try {
    const json: unknown = await response.json();
    if (json && typeof json === "object" && "error" in json) {
      const error = (json as { error?: unknown }).error;
      if (typeof error === "string") return error;
    }
  } catch {
    // Use the safe fallback when an intermediary returns a non-JSON error.
  }
  return fallback;
}

/**
 * Single-purpose staff consent screen. The linked staff account is verified by
 * /api/notifications/push/subscription; never accept a staff ID from the URL.
 * Only a deliberate user click may request browser notification permission.
 */
export default function EnableNotificationsPage() {
  const [state, setState] = useState<ActivationState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (isIosDevice() && !installedAsApp()) {
        if (!cancelled) setState("ios_install");
        return;
      }
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const response = await fetch("/api/notifications/push/subscription", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 401) {
          setState("login_required");
          return;
        }
        if (!response.ok) {
          setError(await errorFrom(response, "Your account cannot enable notifications yet."));
          setState("unavailable");
          return;
        }
        const details = (await response.json()) as { configured?: boolean };
        if (!details.configured || !PUBLIC_KEY) {
          setState("unavailable");
          setError("Notifications are not configured for this device yet.");
          return;
        }
        setState("ready");
      } catch {
        if (!cancelled) {
          setError("Could not connect to CradleHub. Check your connection and reopen this page.");
          setState("unavailable");
        }
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (state !== "ready" && state !== "failed" && state !== "enabled_unverified") return;
    setError(null);

    try {
      // Must be invoked directly inside the tap handler, before any await.
      const permissionRequest =
        Notification.permission === "granted"
          ? Promise.resolve<NotificationPermission>("granted")
          : Notification.requestPermission();
      setState("working");
      const permission = await permissionRequest;
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "ready");
        return;
      }

      const registration = await navigator.serviceWorker.register("/cradlehub-push-sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toKey(PUBLIC_KEY),
        }));

      const save = await fetch("/api/notifications/push/subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!save.ok) {
        setError(await errorFrom(save, "CradleHub could not save your phone subscription."));
        setState(save.status === 401 ? "login_required" : "failed");
        return;
      }

      // Optional verification without an additional tap. Do not claim that the
      // user saw a notification merely because the API accepted the request.
      const test = await fetch("/api/notifications/push/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => null);

      setState(test?.ok ? "enabled" : "enabled_unverified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notification setup failed.");
      setState("failed");
    }
  }

  const ready = state === "ready" || state === "failed" || state === "enabled_unverified";
  const complete = state === "enabled" || state === "enabled_unverified";

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-md items-center justify-center px-5 py-12">
      <div className="w-full rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm">
        <div aria-hidden="true" className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
          {complete ? "✓" : "🔔"}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#153A2D]">
          {complete ? "Notifications connected" : "Enable CradleHub alerts"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {complete
            ? "Your phone is registered to receive CradleHub notifications. You can close this page."
            : "Get important shift, booking and attendance updates on your phone. This does not clock you in or change your schedule."}
        </p>

        <div className="mt-6" role="status" aria-live="polite">
          {state === "checking" && <p className="text-sm text-stone-500">Checking your phone…</p>}
          {ready && (
            <button
              type="button"
              disabled={state === "working"}
              onClick={() => void enable()}
              className="w-full rounded-xl bg-[#153A2D] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#23533f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153A2D]"
            >
              {state === "enabled_unverified" ? "Retry test notification" : "Enable notifications"}
            </button>
          )}
          {state === "working" && <p className="text-sm text-stone-600">Connecting your phone…</p>}
          {state === "enabled" && (
            <p className="text-sm font-medium text-emerald-700">
              A test notification was sent. If it appears, you are all set.
            </p>
          )}
          {state === "enabled_unverified" && (
            <p className="text-sm text-amber-700">
              Permission and subscription were saved, but test delivery could not be confirmed. Ask your supervisor for help if no alert appears.
            </p>
          )}
          {state === "login_required" && (
            <div className="space-y-3">
              <p className="text-sm text-stone-600">Sign in to your own staff account first, then reopen this same link.</p>
              <Link href="/staff/login" className="inline-flex rounded-xl bg-[#153A2D] px-6 py-3 font-semibold text-white">
                Sign in to CradleHub
              </Link>
            </div>
          )}
          {state === "ios_install" && (
            <div className="text-left text-sm leading-6 text-stone-700">
              <p className="font-semibold">For iPhone or iPad:</p>
              <p>Open CradleHub in Safari, choose Share → Add to Home Screen, then open CradleHub from its new Home Screen icon and return to this notification link.</p>
              <p className="mt-2 text-stone-500">Apple requires the installed Home Screen app for web push.</p>
            </div>
          )}
          {state === "blocked" && (
            <p className="text-sm text-amber-700">
              Notifications are blocked for this site. Allow notifications in your phone/browser settings, then reopen this page.
            </p>
          )}
          {state === "unsupported" && (
            <p className="text-sm text-amber-700">
              This browser cannot enable web push. Open the link in Chrome on Android or the installed CradleHub app on iPhone.
            </p>
          )}
          {state === "unavailable" && <p className="text-sm text-amber-700">{error}</p>}
          {state === "failed" && <p className="mb-3 text-sm text-amber-700">{error}</p>}
        </div>
        {ready && state !== "enabled_unverified" && (
          <p className="mt-3 text-xs text-stone-500">Tap Enable, choose Allow on your phone, then close this page.</p>
        )}
        <p className="mt-7 text-xs text-stone-400">CradleHub • Staff notifications</p>
      </div>
    </main>
  );
}
