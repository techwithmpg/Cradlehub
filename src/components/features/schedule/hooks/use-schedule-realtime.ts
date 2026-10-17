"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { ScheduleRealtimeChange } from "@/lib/schedule/schedule-workspace-realtime-merge";

type RealtimePayload = {
  eventType?: string;
  new?: unknown;
  old?: unknown;
};

type UseScheduleRealtimeParams = {
  branchId: string;
  date: string;
  onInvalidate: () => void;
  onBookingChange?: (change: ScheduleRealtimeChange) => void;
  onAttendanceChange?: (change: ScheduleRealtimeChange) => void;
};

function toChange(payload: RealtimePayload): ScheduleRealtimeChange {
  return {
    eventType: payload.eventType ?? "UPDATE",
    newRow: payload.new,
    oldRow: payload.old,
  };
}

export function useScheduleRealtime({
  branchId,
  date,
  onInvalidate,
  onBookingChange,
  onAttendanceChange,
}: UseScheduleRealtimeParams) {
  const callbacksRef = useRef({ onInvalidate, onBookingChange, onAttendanceChange });

  useEffect(() => {
    callbacksRef.current = { onInvalidate, onBookingChange, onAttendanceChange };
  }, [onInvalidate, onBookingChange, onAttendanceChange]);

  useEffect(() => {
    if (!branchId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const invalidate = () => {
      callbacksRef.current.onInvalidate();
    };
    const handleBooking = (payload: RealtimePayload) => {
      const callback = callbacksRef.current.onBookingChange;
      if (callback) callback(toChange(payload));
      else invalidate();
    };
    const handleAttendance = (payload: RealtimePayload) => {
      const callback = callbacksRef.current.onAttendanceChange;
      if (callback) callback(toChange(payload));
      else invalidate();
    };

    const channel = supabase
      .channel(`schedule-live-${branchId}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `branch_id=eq.${branchId}`,
        },
        handleBooking
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff",
          filter: `branch_id=eq.${branchId}`,
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "branch_resources",
          filter: `branch_id=eq.${branchId}`,
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_schedules",
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_overrides",
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_times",
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_shift_checkins",
          filter: `branch_id=eq.${branchId}`,
        },
        handleAttendance
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, date]);
}
