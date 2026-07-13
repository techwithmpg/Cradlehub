"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

type UseScheduleRealtimeParams = {
  branchId: string;
  date: string;
  onInvalidate: () => void;
};

export function useScheduleRealtime({
  branchId,
  date,
  onInvalidate,
}: UseScheduleRealtimeParams) {
  const onInvalidateRef = useRef(onInvalidate);

  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const invalidate = () => {
      onInvalidateRef.current();
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
        invalidate
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
        invalidate
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, date]);
}
