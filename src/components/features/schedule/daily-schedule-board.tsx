"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { createBrowserClient } from "@supabase/ssr";
import {
  STAFF_CELL_WIDTH_PX,
  getTimelineTotalWidthPx,
  isToday,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import { ScheduleTimeHeader } from "./schedule-time-header";
import { ScheduleCurrentTimeIndicator } from "./schedule-current-time-indicator";
import { ScheduleStaffGroup, classifyStaffGroup } from "./schedule-staff-group";
import { useScheduleDensity } from "./schedule-density";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type DailyScheduleBoardProps = {
  branchId: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources?: ResourceRow[];
  onBookingClick?: (bookingId: string) => void;
  selectedBookingId?: string | null;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  onStaffClick?: (staffId: string) => void;
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
          // Invalidate SWR cache (used by CrmScheduleView)
          void mutate(`/api/crm/schedule?date=${date}`);
          // Also refresh Next.js router state for non-SWR pages (owner/manager)
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
  branchResources,
  onBookingClick,
  selectedBookingId,
  onHoverEnter,
  onHoverLeave,
  onStaffClick,
}: DailyScheduleBoardProps) {
  useScheduleRealtime(branchId, date);
  useScheduleDensity();

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

  // Group staff by operational status
  const groups = {
    in_progress: [] as DailyScheduleStaffRow[],
    scheduled: [] as DailyScheduleStaffRow[],
    off_today: [] as DailyScheduleStaffRow[],
  };

  for (const staff of staffRows) {
    const key = classifyStaffGroup(staff);
    groups[key].push(staff);
  }

  return (
    <div
      className="cs-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: "var(--cs-r-lg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Fixed-height scrollable board */}
      <div
        style={{
          overflow: "auto",
          maxHeight: "calc(100vh - 480px)",
          minHeight: 360,
        }}
      >
        <div style={{ minWidth: STAFF_CELL_WIDTH_PX + getTimelineTotalWidthPx() }}>
          <ScheduleTimeHeader />

          <div style={{ position: "relative" }}>
            {showCurrentTime && <ScheduleCurrentTimeIndicator />}

            <ScheduleStaffGroup
              groupKey="in_progress"
              staffList={groups.in_progress}
              branchResources={branchResources}
              date={date}
              defaultExpanded={true}
              onBookingClick={onBookingClick}
              selectedBookingId={selectedBookingId}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onStaffClick={onStaffClick}
            />

            <ScheduleStaffGroup
              groupKey="scheduled"
              staffList={groups.scheduled}
              branchResources={branchResources}
              date={date}
              defaultExpanded={true}
              onBookingClick={onBookingClick}
              selectedBookingId={selectedBookingId}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onStaffClick={onStaffClick}
            />

            <ScheduleStaffGroup
              groupKey="off_today"
              staffList={groups.off_today}
              branchResources={branchResources}
              date={date}
              defaultExpanded={false}
              onBookingClick={onBookingClick}
              selectedBookingId={selectedBookingId}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onStaffClick={onStaffClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
