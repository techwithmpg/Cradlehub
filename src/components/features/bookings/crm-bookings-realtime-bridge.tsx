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

const RECONCILE_DEBOUNCE_MS = 200;

export function CrmBookingsRealtimeBridge({ branchId }: { branchId: string }) {
  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    const filter = `branch_id=eq.${branchId}`;
    let disposed = false;
    let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
    let subscribed = false;
    let lastFocusRecoveryAt = Date.now();

    const reconcile = () => {
      if (disposed) return;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        if (!disposed) notifyBookingsChanged();
      }, RECONCILE_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`crm-booking-reconciliation:${branchId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "bookings",
        filter,
      }, reconcile)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "bookings",
        filter,
      }, reconcile)
      .subscribe((status) => {
        // The first subscription closes the SSR-to-hydration gap. Subsequent
        // subscriptions recover changes missed while disconnected.
        if (status === "SUBSCRIBED") {
          subscribed = true;
          reconcile();
        } else if (subscribed && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
          reconcile();
        }
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const onOnline = () => reconcile();
    const onFocus = () => {
      // Focus can fire repeatedly while staff use drawers and other windows.
      // Limit recovery reads; active realtime events are not throttled here.
      if (Date.now() - lastFocusRecoveryAt < 30_000) return;
      lastFocusRecoveryAt = Date.now();
      reconcile();
    };

    // Reconcile after sleep/offline even if the realtime socket missed events.
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
