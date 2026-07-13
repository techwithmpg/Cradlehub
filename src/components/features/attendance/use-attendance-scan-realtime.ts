"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAttendanceScanRealtime({
  branchId,
  selectedDate,
  onRefresh,
}: {
  branchId: string | null;
  selectedDate: string;
  onRefresh: () => void;
}) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(
      `attendance-scan-feed-${branchId ?? "all"}-${selectedDate}`
    );
    const filter = branchId ? `branch_id=eq.${branchId}` : undefined;

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "qr_scan_events",
        ...(filter ? { filter } : {}),
      },
      (payload) => {
        const row = payload.new as {
          scan_type?: string;
          outcome?: string;
          action?: string;
        };
        const isAttendanceScan =
          row.scan_type === "attendance";

        if (isAttendanceScan) onRefresh();
      }
    );
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, onRefresh, selectedDate]);
}
