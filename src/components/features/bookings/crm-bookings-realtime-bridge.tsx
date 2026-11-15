"use client";

/**
 * CRM booking reconciliation across front-desk computers.
 *
 * Server-authorized CRM reads remain the source of truth. Realtime events are
 * invalidation hints only: never merge untrusted event payloads into bookings.
 * Supabase Postgres Changes applies authenticated SELECT RLS to each event,
 * and the branch filter is derived from trusted server layout context.
 */
import { useEffect } from "react";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { createClient } from "@/lib/supabase/client";

const RECONCILE_DEBOUNCE_MS = 250;
const FOCUS_RECOVERY_COOLDOWN_MS = 30_000;

export function CrmBookingsRealtimeBridge({ branchId }: { branchId: string }) {
  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    const filter = `branch_id=eq.${branchId}`;
    let disposed = false;
    let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
    let hadDisconnect = false;
    let lastRecoveryAt = Date.now();

    const reconcile = () => {
      if (disposed) return;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        if (!disposed) {
          lastRecoveryAt = Date.now();
          notifyBookingsChanged();
        }
      }, RECONCILE_DEBOUNCE_MS);
    };

    const reconcileWithCooldown = () => {
      if (Date.now() - lastRecoveryAt < FOCUS_RECOVERY_COOLDOWN_MS) return;
      reconcile();
    };

    const channel = supabase
      .channel(`crm-booking-reconciliation:${branchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          filter,
        },
        reconcile
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter,
        },
        reconcile
      )
      .subscribe((status) => {
        // Only trigger a full reconciliation when recovering from a dropped socket,
        // NOT on initial mount 200ms after SSR already delivered fresh bookings.
        if (status === "SUBSCRIBED") {
          if (hadDisconnect) {
            hadDisconnect = false;
            reconcile();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          hadDisconnect = true;
        }
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reconcileWithCooldown();
    };
    const onOnline = () => reconcile();
    const onFocus = () => reconcileWithCooldown();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  return null;
}
