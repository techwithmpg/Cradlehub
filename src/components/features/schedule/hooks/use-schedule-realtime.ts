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
  staffIds?: readonly string[];
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
  staffIds = [],
  onInvalidate,
  onBookingChange,
  onAttendanceChange,
}: UseScheduleRealtimeParams) {
  const callbacksRef = useRef({ onInvalidate, onBookingChange, onAttendanceChange });

  const staffScopeRef = useRef(new Set(staffIds));

  useEffect(() => {
    staffScopeRef.current = new Set(staffIds);
  }, [staffIds]);

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
    const handleBooking = (payload: RealtimePayload = {}) => {
      const callback = callbacksRef.current.onBookingChange;
      if (callback) callback(toChange(payload));
      else invalidate();
    };
    const handleAttendance = (payload: RealtimePayload = {}) => {
      const callback = callbacksRef.current.onAttendanceChange;
      if (callback) callback(toChange(payload));
      else invalidate();
    };
    const handleStructureChange =
      (table: "staff_schedules" | "schedule_overrides" | "blocked_times") =>
      (payload: RealtimePayload = {}) => {
        const row =
          payload.new && typeof payload.new === "object"
            ? (payload.new as Record<string, unknown>)
            : payload.old && typeof payload.old === "object"
              ? (payload.old as Record<string, unknown>)
              : null;
        const staffId = typeof row?.staff_id === "string" ? row.staff_id : null;
        if (staffId && staffScopeRef.current.size > 0 && !staffScopeRef.current.has(staffId)) {
          return;
        }
        if (table === "schedule_overrides") {
          const overrideDate =
            typeof row?.override_date === "string" ? row.override_date : null;
          if (overrideDate && overrideDate !== date) return;
        }
        if (table === "blocked_times") {
          const blockDate = typeof row?.block_date === "string" ? row.block_date : null;
          if (blockDate && blockDate !== date) return;
        }
        invalidate();
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
        handleStructureChange("staff_schedules")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_overrides",
        },
        handleStructureChange("schedule_overrides")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_times",
        },
        handleStructureChange("blocked_times")
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
