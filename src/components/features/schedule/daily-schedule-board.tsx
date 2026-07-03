"use client";

import { useMemo } from "react";
import {
  EXPANDED_HOUR_WIDTH_PX,
  STAFF_CELL_WIDTH_EXPANDED_PX,
  STAFF_CELL_WIDTH_FIT_PX,
  buildTimelineRange,
  isToday,
  type TimelineDisplayMode,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import { ScheduleTimeHeader } from "./schedule-time-header";
import { ScheduleCurrentTimeIndicator } from "./schedule-current-time-indicator";
import { ScheduleStaffGroup, classifyStaffGroup } from "./schedule-staff-group";
import { useScheduleDensity } from "./schedule-density";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type DailyScheduleBoardProps = {
  date: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources?: ResourceRow[];
  onBookingClick?: (bookingId: string) => void;
  selectedBookingId?: string | null;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  onStaffClick?: (staffId: string) => void;
  timelineMode?: TimelineDisplayMode;
};

export function DailyScheduleBoard({
  date,
  staffRows,
  branchResources,
  onBookingClick,
  selectedBookingId,
  onHoverEnter,
  onHoverLeave,
  onStaffClick,
  timelineMode = "expanded",
}: DailyScheduleBoardProps) {
  useScheduleDensity();

  const timelineRange = useMemo(() => buildTimelineRange(staffRows), [staffRows]);
  const staffColumnWidth =
    timelineMode === "expanded" ? STAFF_CELL_WIDTH_EXPANDED_PX : STAFF_CELL_WIDTH_FIT_PX;
  const timelineMinWidth = timelineRange.hourCount * EXPANDED_HOUR_WIDTH_PX;

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
        width: "100%",
        maxWidth: "100%",
      }}
    >
      {/* Fixed-height scrollable board */}
      <div
        style={{
          overflowX: timelineMode === "expanded" ? "auto" : "hidden",
          overflowY: "auto",
          maxHeight: timelineMode === "expanded" ? "calc(100vh - 440px)" : "calc(100vh - 380px)",
          minHeight: 360,
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            width: "100%",
            minWidth: timelineMode === "expanded" ? staffColumnWidth + timelineMinWidth : 0,
            maxWidth: timelineMode === "fit" ? "100%" : undefined,
          }}
        >
          <ScheduleTimeHeader
            timelineRange={timelineRange}
            timelineMode={timelineMode}
            staffColumnWidth={staffColumnWidth}
            timelineMinWidth={timelineMinWidth}
          />

          <div style={{ position: "relative" }}>
            {showCurrentTime && (
              <ScheduleCurrentTimeIndicator
                timelineRange={timelineRange}
                timelineMode={timelineMode}
                staffColumnWidth={staffColumnWidth}
                timelineMinWidth={timelineMinWidth}
              />
            )}

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
              timelineRange={timelineRange}
              timelineMode={timelineMode}
              staffColumnWidth={staffColumnWidth}
              timelineMinWidth={timelineMinWidth}
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
              timelineRange={timelineRange}
              timelineMode={timelineMode}
              staffColumnWidth={staffColumnWidth}
              timelineMinWidth={timelineMinWidth}
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
              timelineRange={timelineRange}
              timelineMode={timelineMode}
              staffColumnWidth={staffColumnWidth}
              timelineMinWidth={timelineMinWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
