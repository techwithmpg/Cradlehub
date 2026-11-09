"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getCrmPendingBookingSnapshotAction } from "@/app/(dashboard)/crm/pending-booking-actions";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import {
  pendingBookingPresentation,
  type PendingCrmBookingSnapshot,
} from "@/lib/notifications/pending-booking-policy";

const POLL_MS = 30_000;

function isSafeToPresent() {
  if (document.visibilityState !== "visible") return false;
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return false;
  const active = document.activeElement;
  return !(active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable));
}

function readLastShown(key: string): number | null {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberShown(key: string, now: number) {
  try {
    window.localStorage.setItem(key, String(now));
  } catch {
    // Storage may be disabled; current-tab presentation remains usable.
  }
}

/**
 * Global CRM-only presenter. The authoritative queue is the bookings table.
 * No dismissal or snooze action mutates shared booking/notification state.
 * Repeated reminders are per signed-in CSR + branch + booking, not a global
 * "mark read" that could suppress a colleague's action.
 */
export function CrmPendingBookingAlert({
  branchId,
  userId,
}: {
  branchId: string;
  userId: string;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const currentToast = useRef<string | null>(null);
  const active = useRef(true);

  const reconcile = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const snapshot: PendingCrmBookingSnapshot = await getCrmPendingBookingSnapshotAction();
      if (!active.current || !snapshot.ok) return;

      const one = snapshot.onDuty && snapshot.pendingCount === 1 ? snapshot.first : null;
      const toastId = one ? "crm-pending-confirmation:" + userId + ":" + branchId + ":" + one.id : null;
      if (currentToast.current && currentToast.current !== toastId) {
        toast.dismiss(currentToast.current);
        currentToast.current = null;
      }
      if (!toastId || !one) return;

      const now = Date.now();
      const key = "crm-pending-reminder:" + userId + ":" + branchId + ":" + one.id;
      const mode = pendingBookingPresentation(snapshot, {
        now,
        lastPresentedAt: readLastShown(key),
        safeToInterrupt: isSafeToPresent(),
      });
      if (mode !== "single") return;

      // Best-effort tab coordination. A cross-tab lock avoids simultaneous
      // reminders when the browser exposes the Web Locks API.
      const show = () => {
        if (!active.current || !isSafeToPresent()) return;
        if (pendingBookingPresentation(snapshot, {
          now: Date.now(),
          lastPresentedAt: readLastShown(key),
          safeToInterrupt: true,
        }) !== "single") return;
        rememberShown(key, Date.now());
        currentToast.current = toastId;
        toast("Booking awaiting confirmation", {
          id: toastId,
          description: one.customerName + " · " + one.serviceName + " · " +
            one.bookingDate + " at " + one.startTime.slice(0, 5),
          duration: 12_000,
          action: {
            label: "Review booking",
            onClick: () => router.push("/crm/bookings?bookingId=" + encodeURIComponent(one.id) + "&tab=needs-action"),
          },
          cancel: { label: "Later", onClick: () => toast.dismiss(toastId) },
        });
      };
      if ("locks" in navigator && navigator.locks) {
        await navigator.locks.request("crm-pending:" + userId + ":" + branchId + ":" + one.id, show);
      } else {
        show();
      }
    } catch {
      // An unreachable server is not a resolved booking. The next focus/poll
      // reconciles from authoritative status without generating false alerts.
    } finally {
      inFlight.current = false;
    }
  }, [branchId, router, userId]);

  useEffect(() => {
    active.current = true;
    const initial = window.setTimeout(() => void reconcile(), 0);
    const interval = window.setInterval(() => void reconcile(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void reconcile(); };
    const onEditEnd = () => void reconcile();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("focusout", onEditEnd);
    window.addEventListener("focus", onVisible);
    window.addEventListener(BOOKINGS_CHANGED_EVENT, onVisible);
    return () => {
      active.current = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("focusout", onEditEnd);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, onVisible);
      if (currentToast.current) toast.dismiss(currentToast.current);
    };
  }, [reconcile]);

  return null;
}
