"use client";

import { useEffect, useRef } from "react";
import {
  isCompleteAttendanceCheckinRow,
  type AttendanceCheckinRealtimeRow,
} from "@/lib/attendance/attendance-workspace-realtime-merge";
import { createClient } from "@/lib/supabase/client";

const REFRESH_TABLES = [
  "attendance_exceptions",
  "attendance_corrections",
  "staff_devices",
  "bookings",
] as const;

export function useAttendanceWorkspaceRealtime({
  branchId,
  onCheckinChange,
  onRefresh,
}: {
  branchId: string;
  onCheckinChange: (row: AttendanceCheckinRealtimeRow) => void;
  onRefresh: () => void;
}) {
  const callbacksRef = useRef({ onCheckinChange, onRefresh });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbacksRef.current = { onCheckinChange, onRefresh };
  }, [onCheckinChange, onRefresh]);

  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    const channel = supabase.channel(`attendance-workspace-${branchId}`);
    const filter = `branch_id=eq.${branchId}`;

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbacksRef.current.onRefresh(), 500);
    }

    const handleCheckin = (payload: { new: unknown }) => {
      if (isCompleteAttendanceCheckinRow(payload.new)) {
        callbacksRef.current.onCheckinChange(payload.new);
      } else {
        scheduleRefresh();
      }
    };
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_shift_checkins", filter },
        handleCheckin
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "staff_shift_checkins", filter },
        handleCheckin
      );

    for (const table of REFRESH_TABLES) {
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
  }, [branchId]);
}
