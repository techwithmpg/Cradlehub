"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, MapPinned } from "lucide-react";
import { getDriverTripAlertAction, type DriverTripAlert } from "@/app/(dashboard)/staff/driver/trip-alert-action";
import { markStaffNoticeRead } from "@/lib/staff-pwa/notice-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";
type Readiness = "checking" | "enabled" | "disabled" | "blocked" | "unavailable" | "error";

function decodeKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function supported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window;
}

export function DriverTripAlerts() {
  const router = useRouter();
  const [readiness, setReadiness] = useState<Readiness>("checking");
  const [alert, setAlert] = useState<DriverTripAlert | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  const reloadAlert = useCallback(async () => {
    try {
      const result = await getDriverTripAlertAction();
      if (result.ok) setAlert(result.alert);
      else setAlert(null);
    } catch {
      // Retain existing visible alert during transient connectivity loss.
    }
  }, []);

  useEffect(() => {
    const read = async () => {
      if (!supported()) { setReadiness("unavailable"); return; }
      if (Notification.permission === "denied") { setReadiness("blocked"); return; }
      try {
        const [registration, response] = await Promise.all([
          navigator.serviceWorker.getRegistration("/"),
          fetch("/api/notifications/push/subscription", { cache: "no-store" }),
        ]);
        if (!response.ok) { setReadiness("error"); return; }
        const status = (await response.json()) as {
          configured?: boolean; workspace?: string; activeSubscriptionCount?: number;
        };
        if (status.workspace !== "driver") { setReadiness("error"); return; }
        if (!status.configured || !PUBLIC_KEY) { setReadiness("unavailable"); return; }
        const subscription = await registration?.pushManager.getSubscription();
        setReadiness(
          Notification.permission === "granted" &&
          subscription && (status.activeSubscriptionCount ?? 0) > 0
            ? "enabled" : "disabled"
        );
      } catch { setReadiness("error"); }
    };
    void read();
    const firstCheck = window.setTimeout(() => void reloadAlert(), 0);
    const onResume = () => { if (document.visibilityState === "visible") void reloadAlert(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadAlert();
    }, 20000);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [reloadAlert]);

  async function enable() {
    if (!supported() || busy || !PUBLIC_KEY) return;
    setBusy(true);
    setMessage(null);
    try {
      // Browser permission is only requested after this explicit button tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setReadiness(permission === "denied" ? "blocked" : "disabled");
        setMessage("Allow notifications in your phone settings to receive trip alerts.");
        return;
      }
      const registration = await navigator.serviceWorker.register(
        "/cradlehub-push-sw.js", { scope: "/", updateViaCache: "none" }
      );
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(PUBLIC_KEY),
        });
      const response = await fetch("/api/notifications/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        setReadiness("error");
        setMessage("Trip alerts could not be connected. Ask CRM for assistance.");
        return;
      }
      setReadiness("enabled");
      setMessage("Trip alerts are ready on this phone.");
    } catch {
      setReadiness("error");
      setMessage("Trip alerts are unavailable. Ask CRM to check this phone.");
    } finally {
      setBusy(false);
    }
  }

  function openRoute(item: DriverTripAlert) {
    if (opening) return;
    startOpening(async () => {
      try { await markStaffNoticeRead(item.id); } catch { /* Route authority is independent. */ }
      setAlert(null);
      router.push(item.href);
    });
  }

  return (
    <section className="mt-3 space-y-2" aria-label="Driver trip alerts">
      {alert ? (
        <div className="rounded-2xl border border-[#c8a96b] bg-[#fff8e9] p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-[#744b14]">
            <BellRing size={18} aria-hidden="true" /> New Home Service trip
          </p>
          <p className="mt-2 text-sm font-semibold text-[#163a2b]">{alert.title}</p>
          <p className="mt-1 text-xs text-[#68776d]">{alert.body}</p>
          <button type="button" onClick={() => openRoute(alert)} disabled={opening}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#163a2b] text-sm font-bold text-white disabled:opacity-60">
            <MapPinned size={18} /> {opening ? "Opening…" : "Open trip and route"}
          </button>
        </div>
      ) : null}
      {readiness === "enabled" ? (
        <p role="status" className="flex items-center gap-2 px-2 text-xs text-[#19563c]">
          <CheckCircle2 size={16} aria-hidden="true" /> Trip notifications enabled on this phone
        </p>
      ) : readiness !== "checking" ? (
        <div className="rounded-xl border border-[#e5d2ad] bg-white p-3">
          <p className="text-xs font-semibold text-[#163a2b]">
            {readiness === "blocked" ? "Phone notifications are blocked" :
              readiness === "unavailable" ? "Phone push is not available here" :
              "Enable Home Service trip alerts"}
          </p>
          <p className="mt-1 text-xs text-[#68776d]">
            {readiness === "unavailable"
              ? "Your assigned trips still appear here. On iPhone, install CradleHub to Home Screen and allow notifications."
              : readiness === "blocked"
                ? "Allow notifications for CradleHub in the phone settings."
                : "One-time setup to receive new assignments, even when you are not viewing this page."}
          </p>
          {readiness !== "blocked" && readiness !== "unavailable" ? (
            <button type="button" onClick={() => void enable()} disabled={busy}
              className="mt-2 min-h-11 rounded-xl bg-[#163a2b] px-4 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Enabling…" : "Enable trip alerts"}
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p role="status" className="px-2 text-xs text-[#744b14]">{message}</p> : null}
    </section>
  );
}
