"use client";

import { useEffect, useRef, useState } from "react";
import type { AttendanceRealtimeScanRow } from "@/lib/attendance/recent-scan-event";
import { createClient } from "@/lib/supabase/client";

export const DEGRADED_RECONCILE_INTERVAL_MS = 60_000;
export const ATTENDANCE_VISIBILITY_STALE_MS = 2 * 60_000;

export type AttendanceRealtimeStatus = "connecting" | "live" | "delayed" | "offline";

export function useAttendanceScanRealtime({
  branchId,
  selectedDate,
  onScanEvent,
  onReconcile,
}: {
  branchId: string | null;
  selectedDate: string;
  onScanEvent: (row: AttendanceRealtimeScanRow) => void;
  onReconcile: () => void;
}) {
  const [status, setStatus] = useState<AttendanceRealtimeStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "connecting"
  );
  const statusRef = useRef<AttendanceRealtimeStatus>(status);
  const callbacksRef = useRef({ onScanEvent, onReconcile });

  useEffect(() => {
    callbacksRef.current = { onScanEvent, onReconcile };
  }, [onReconcile, onScanEvent]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`attendance-scan-feed-${branchId ?? "all"}-${selectedDate}`);
    const filter = branchId ? `branch_id=eq.${branchId}` : undefined;
    let disposed = false;
    let subscribedOnce = false;
    let disconnectedTimer: number | null = null;
    let hiddenAt: number | null = null;

    const clearDisconnectedFallback = () => {
      if (disconnectedTimer !== null) {
        window.clearInterval(disconnectedTimer);
        disconnectedTimer = null;
      }
    };
    const startDisconnectedFallback = () => {
      if (disconnectedTimer !== null) return;
      disconnectedTimer = window.setInterval(() => {
        if (
          statusRef.current !== "live" &&
          navigator.onLine &&
          document.visibilityState === "visible"
        ) {
          callbacksRef.current.onReconcile();
        }
      }, DEGRADED_RECONCILE_INTERVAL_MS);
    };

    queueMicrotask(() => {
      if (!disposed) setStatus(navigator.onLine ? "connecting" : "offline");
    });

    const scanChange = {
      schema: "public",
      table: "qr_scan_events",
      ...(filter ? { filter } : {}),
    } as const;
    const handleScanChange = (payload: { new: unknown }) => {
      const row = payload.new as Partial<AttendanceRealtimeScanRow>;
      if (row.scan_type === "attendance" && row.is_test === false) {
        callbacksRef.current.onScanEvent(row as AttendanceRealtimeScanRow);
      }
    };

    channel
      .on("postgres_changes", { event: "INSERT", ...scanChange }, handleScanChange)
      .on("postgres_changes", { event: "UPDATE", ...scanChange }, handleScanChange)
      .subscribe((nextStatus) => {
        if (disposed) return;

        if (nextStatus === "SUBSCRIBED") {
          clearDisconnectedFallback();
          setStatus("live");
          if (subscribedOnce) callbacksRef.current.onReconcile();
          subscribedOnce = true;
          return;
        }

        if (
          nextStatus === "CHANNEL_ERROR" ||
          nextStatus === "TIMED_OUT" ||
          nextStatus === "CLOSED"
        ) {
          setStatus(navigator.onLine ? "delayed" : "offline");
          startDisconnectedFallback();
        }
      });

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const stale = hiddenAt !== null && Date.now() - hiddenAt >= ATTENDANCE_VISIBILITY_STALE_MS;
      hiddenAt = null;
      if (stale) callbacksRef.current.onReconcile();
    };
    const handleOnline = () => {
      setStatus((current) => (current === "live" ? "live" : "connecting"));
      if (statusRef.current !== "live") startDisconnectedFallback();
    };
    const handleOffline = () => {
      setStatus("offline");
      startDisconnectedFallback();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      clearDisconnectedFallback();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      void supabase.removeChannel(channel);
    };
  }, [branchId, selectedDate]);

  return status;
}
