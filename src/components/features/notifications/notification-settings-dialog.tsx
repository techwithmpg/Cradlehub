"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Settings2, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { canonicalizeSystemRole } from "@/constants/staff";
import type { OwnerBookingPreference } from "@/lib/notifications/push/schemas";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from "./notification-sound-preference";

type PermissionState = NotificationPermission | "unsupported";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

const OWNER_PREFERENCE_LABELS: Record<OwnerBookingPreference, string> = {
  all: "All bookings",
  home_service_and_urgent: "Home Service and urgent only",
  urgent_only: "Urgent only",
  disabled: "Disabled",
};

function supportsBrowserPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined" &&
    typeof Notification !== "undefined"
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function getCurrentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function NotificationSettingsDialog({ role }: { role: string }) {
  const canonicalRole = canonicalizeSystemRole(role);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ownerPreference, setOwnerPreference] =
    useState<OwnerBookingPreference>("home_service_and_urgent");

  const loadState = useCallback(async () => {
    setSoundEnabled(isNotificationSoundEnabled());
    if (!supportsBrowserPush()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setLoading(true);
    try {
      const [currentSubscription, statusResponse, preferenceResponse] =
        await Promise.all([
          getCurrentSubscription(),
          fetch("/api/notifications/push/subscription", {
            cache: "no-store",
          }),
          canonicalRole === "owner"
            ? fetch("/api/notifications/preferences", { cache: "no-store" })
            : Promise.resolve(null),
        ]);
      setSubscription(currentSubscription);
      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as { configured?: boolean };
        setConfigured(status.configured !== false);
      } else {
        setConfigured(false);
      }
      if (preferenceResponse?.ok) {
        const value = (await preferenceResponse.json()) as {
          ownerBookingPreference?: OwnerBookingPreference;
        };
        if (
          value.ownerBookingPreference &&
          value.ownerBookingPreference in OWNER_PREFERENCE_LABELS
        ) {
          setOwnerPreference(value.ownerBookingPreference);
        }
      }
    } catch {
      toast.error("Could not load notification settings.");
    } finally {
      setLoading(false);
    }
  }, [canonicalRole]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      void loadState();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadState, open]);

  async function enablePush() {
    if (!supportsBrowserPush()) return;
    setBusy(true);
    try {
      // This is intentionally the only permission request and runs from the
      // explicit Enable button click.
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      if (!PUBLIC_VAPID_KEY || !configured) {
        throw new Error("Browser notifications are not configured.");
      }

      const registration = await navigator.serviceWorker.register(
        "/cradlehub-push-sw.js",
        { scope: "/", updateViaCache: "none" }
      );
      const nextSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        }));
      const serialized = nextSubscription.toJSON();
      const response = await fetch("/api/notifications/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serialized),
      });
      if (!response.ok) {
        await nextSubscription.unsubscribe().catch(() => false);
        throw new Error(
          await readApiError(response, "Could not enable browser notifications.")
        );
      }
      setSubscription(nextSubscription);
      toast.success("Browser notifications enabled.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not enable browser notifications."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!subscription) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Could not disable browser notifications.")
        );
      }
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success("Browser notifications disabled on this device.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disable browser notifications."
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!subscription) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Test notification could not be sent.")
        );
      }
      toast.success("Test notification sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Test notification could not be sent."
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateOwnerPreference(value: OwnerBookingPreference) {
    const previous = ownerPreference;
    setOwnerPreference(value);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerBookingPreference: value }),
      });
      if (!response.ok) throw new Error("Could not save Owner preference.");
      toast.success("Owner booking alerts updated.");
    } catch (error) {
      setOwnerPreference(previous);
      toast.error(error instanceof Error ? error.message : "Could not save preference.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text-secondary)] transition hover:border-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)] hover:text-[var(--cs-sand-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30"
      >
        <Settings2 className="size-3.5" aria-hidden="true" />
        Notification settings
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notification settings</DialogTitle>
            <DialogDescription>
              Choose how this browser alerts you to operational updates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <section className="rounded-xl border border-[var(--cs-border-soft)] p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-2.5">
                  <Volume2 className="mt-0.5 size-4 shrink-0 text-[var(--cs-sand-dark)]" />
                  <div>
                    <p className="text-sm font-semibold">Booking sound</p>
                    <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                      Play the existing chime once for a new visible booking alert.
                    </p>
                  </div>
                </div>
                <Switch
                  aria-label="Booking sound"
                  checked={soundEnabled}
                  onCheckedChange={(checked) => {
                    setSoundEnabled(checked);
                    setNotificationSoundEnabled(checked);
                  }}
                />
              </div>
            </section>

            <section className="rounded-xl border border-[var(--cs-border-soft)] p-3">
              <div className="flex gap-2.5">
                <BellRing className="mt-0.5 size-4 shrink-0 text-[var(--cs-sand-dark)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Browser push</p>
                  {permission === "unsupported" ? (
                    <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                      Browser notifications are not supported on this device.
                    </p>
                  ) : permission === "denied" ? (
                    <p className="mt-1 text-xs text-[var(--cs-warning-text)]">
                      Notifications are blocked in browser settings. Open this site&apos;s
                      permissions, allow Notifications, then reopen these settings.
                    </p>
                  ) : subscription ? (
                    <div className="mt-1 space-y-3">
                      <p className="flex items-center gap-1.5 text-xs text-[var(--cs-success-text)]">
                        <CheckCircle2 className="size-3.5" />
                        Browser notifications enabled
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="xs" onClick={sendTest} disabled={busy || loading}>
                          Send test notification
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={disablePush}
                          disabled={busy || loading}
                        >
                          Disable
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {!configured ? (
                        <p className="text-xs text-[var(--cs-warning-text)]">
                          Browser notifications are not configured by the operator.
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={enablePush}
                        disabled={busy || loading || !configured}
                      >
                        Enable browser notifications
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {canonicalRole === "owner" ? (
              <section className="rounded-xl border border-[var(--cs-border-soft)] p-3">
                <p className="text-sm font-semibold">Owner booking alerts</p>
                <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                  Applies to native push delivery across branches.
                </p>
                <Select
                  value={ownerPreference}
                  onValueChange={(value) =>
                    void updateOwnerPreference(value as OwnerBookingPreference)
                  }
                >
                  <SelectTrigger className="mt-3 w-full">
                    <SelectValue>{OWNER_PREFERENCE_LABELS[ownerPreference]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OWNER_PREFERENCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
