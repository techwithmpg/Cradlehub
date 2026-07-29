"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LIVE_RECONCILE_INTERVAL_MS = 15_000;
const DEGRADED_RECONCILE_INTERVAL_MS = 8_000;
const EVENT_REFRESH_DEBOUNCE_MS = 250;

export type AttendanceRealtimeStatus = "connecting" | "live" | "delayed" | "offline";

export function useAttendanceScanRealtime({
  branchId,
  selectedDate,
  onRefresh,
}: {
  branchId: string | null;
  selectedDate: string;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<AttendanceRealtimeStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "connecting"
  );
  const statusRef = useRef<AttendanceRealtimeStatus>(status);
  const callbacksRef = useRef({ onRefresh });
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    callbacksRef.current = { onRefresh };
  }, [onRefresh]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      callbacksRef.current.onRefresh();
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channelSuffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(
      `attendance-scan-feed-${branchId ?? "all"}-${selectedDate}-${channelSuffix}`
    );
    const filter = branchId ? `branch_id=eq.${branchId}` : undefined;
    let disposed = false;
    let subscribedOnce = false;

    queueMicrotask(() => {
      if (!disposed) setStatus(navigator.onLine ? "connecting" : "offline");
    });

    const scanChange = {
      schema: "public",
      table: "qr_scan_events",
      ...(filter ? { filter } : {}),
    } as const;
    const checkinChange = {
      schema: "public",
      table: "staff_shift_checkins",
      ...(filter ? { filter } : {}),
    } as const;

    channel
      .on("postgres_changes", { event: "INSERT", ...scanChange }, (payload) => {
        const row = payload.new as { scan_type?: string };
        if (row.scan_type === "attendance") scheduleRefresh();
      })
      .on("postgres_changes", { event: "INSERT", ...checkinChange }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", ...checkinChange }, scheduleRefresh)
      .subscribe((nextStatus) => {
        if (disposed) return;

        if (nextStatus === "SUBSCRIBED") {
          setStatus("live");
          if (subscribedOnce) scheduleRefresh();
          subscribedOnce = true;
          return;
        }

        if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
          setStatus(navigator.onLine ? "delayed" : "offline");
          return;
        }

        if (nextStatus === "CLOSED") {
          setStatus(navigator.onLine ? "delayed" : "offline");
        }
      });

    const reconcile = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const handleOnline = () => {
      setStatus((current) => (current === "live" ? "live" : "connecting"));
      reconcile();
    };
    const handleOffline = () => setStatus("offline");

    let lastReconcileAt = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const interval =
        statusRef.current === "live" ? LIVE_RECONCILE_INTERVAL_MS : DEGRADED_RECONCILE_INTERVAL_MS;
      if (Date.now() - lastReconcileAt < interval) return;
      lastReconcileAt = Date.now();
      scheduleRefresh();
    }, DEGRADED_RECONCILE_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      void supabase.removeChannel(channel);
    };
  }, [branchId, scheduleRefresh, selectedDate]);

  return status;
}
