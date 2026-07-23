"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const ATTENDANCE_REALTIME_TABLES = [
  "staff_shift_checkins",
  "qr_scan_events",
  "attendance_exceptions",
  "attendance_corrections",
  "staff_devices",
  "bookings",
] as const;

export function useAttendanceWorkspaceRealtime({
  branchId,
  onRefresh,
}: {
  branchId: string;
  onRefresh: () => void;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    const channel = supabase.channel(`attendance-workspace-${branchId}`);
    const filter = `branch_id=eq.${branchId}`;

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(onRefresh, 500);
    }

    for (const table of ATTENDANCE_REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        scheduleRefresh
      );
    }

    channel.subscribe();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [branchId, onRefresh]);
}
