"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  STAFF_CELL_WIDTH_PX,
  isToday,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import { ScheduleTimeHeader } from "./schedule-time-header";
import { ScheduleStaffRow } from "./schedule-staff-row";
import { ScheduleCurrentTimeIndicator } from "./schedule-current-time-indicator";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type DailyScheduleBoardProps = {
  branchId: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources?: ResourceRow[];
};

function useScheduleRealtime(branchId: string, date: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, date, router]);
}

export function DailyScheduleBoard({ 
  branchId, 
  date, 
  staffRows,
  branchResources 
}: DailyScheduleBoardProps) {
  useScheduleRealtime(branchId, date);

  if (staffRows.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🌿</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          No staff scheduled
        </div>
        <div>There are no active staff members at this branch for the selected date.</div>
      </div>
    );
  }

  const showCurrentTime = isToday(date);

  return (
    <div
      className="cs-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div style={{ minWidth: STAFF_CELL_WIDTH_PX + 600 }}>
          <ScheduleTimeHeader />

          <div style={{ position: "relative" }}>
            {showCurrentTime && <ScheduleCurrentTimeIndicator />}

            {staffRows.map((staff) => (
              <ScheduleStaffRow 
                key={staff.staff_id} 
                staff={staff} 
                branchResources={branchResources}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
