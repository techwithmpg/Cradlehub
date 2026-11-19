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
import { notifyOptimizationChanged } from "@/lib/optimization/client-events";
import { createClient } from "@/lib/supabase/client";

const RECONCILE_DEBOUNCE_MS = 200;
const FOCUS_RECOVERY_COOLDOWN_MS = 30_000;

export function CrmBookingsRealtimeBridge({ branchId }: { branchId: string }) {
  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    const filter = `branch_id=eq.${branchId}`;
    let disposed = false;
    let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
    let optimizationTimer: ReturnType<typeof setTimeout> | null = null;
    let hadDisconnect = false;
    let lastRecoveryAt = Date.now();

    const triggerOptimizationSync = (reason: string, date?: string) => {
      if (disposed) return;
      if (optimizationTimer) clearTimeout(optimizationTimer);
      optimizationTimer = setTimeout(() => {
        optimizationTimer = null;
        if (!disposed) {
          notifyOptimizationChanged({ branchId, date, reason });
        }
      }, RECONCILE_DEBOUNCE_MS);
    };

    const reconcile = () => {
      if (disposed) return;
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        if (!disposed) {
          lastRecoveryAt = Date.now();
          notifyBookingsChanged();
          notifyOptimizationChanged({ branchId, reason: "booking_or_resource_realtime" });
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_overrides",
        },
        () => triggerOptimizationSync("schedule_override_realtime")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_times",
        },
        () => triggerOptimizationSync("blocked_time_realtime")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "branch_resources",
          filter,
        },
        reconcile
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staff_shift_checkins",
          filter,
        },
        reconcile
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "staff_shift_checkins",
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

    const opsChannel = supabase
      .channel(`crm-ops-sync:${branchId}`)
      .on("broadcast", { event: "ops_updated" }, (message) => {
        const payload = (message?.payload ?? {}) as {
          date?: string;
          reason?: string;
        };
        triggerOptimizationSync(
          typeof payload.reason === "string" ? payload.reason : "ops_broadcast",
          typeof payload.date === "string" ? payload.date : undefined
        );
      })
      .subscribe();

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
      if (optimizationTimer) clearTimeout(optimizationTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(opsChannel);
    };
  }, [branchId]);

  return null;
}
