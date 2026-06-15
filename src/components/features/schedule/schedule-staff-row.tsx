"use client";

import {
  getTimelineBlockPercent,
  getTimelineHourMarks,
  type TimelineDisplayMode,
  type TimelineRange,
} from "@/lib/utils/schedule-timeline";
import { useScheduleDensity } from "./schedule-density";
import { ScheduleStaffCell } from "./schedule-staff-cell";
import { ScheduleBookingBlock } from "./schedule-booking-block";
import { ScheduleBlockedTimeBlock } from "./schedule-blocked-time-block";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type StaffRowProps = {
  staff: DailyScheduleStaffRow;
  branchResources?: ResourceRow[];
  date?: string;
  onBookingClick?: (bookingId: string) => void;
  selectedBookingId?: string | null;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  onStaffClick?: (staffId: string) => void;
  timelineRange: TimelineRange;
  timelineMode: TimelineDisplayMode;
  staffColumnWidth: number;
  timelineMinWidth: number;
};

export function ScheduleStaffRow({
  staff,
  branchResources,
  date,
  onBookingClick,
  selectedBookingId,
  onHoverEnter,
  onHoverLeave,
  onStaffClick,
  timelineRange,
  timelineMode,
  staffColumnWidth,
  timelineMinWidth,
}: StaffRowProps) {
  const { metrics } = useScheduleDensity();
  const rowHeight = metrics.rowHeight;
  const isFullyOff = !staff.work_start || !staff.work_end;
  const hourMarks = getTimelineHourMarks(timelineRange);
  const rowMinWidth = timelineMode === "expanded" ? staffColumnWidth + timelineMinWidth : undefined;

  // Pre-compute off-duty segments
  const offDutyRects: { leftPercent: number; widthPercent: number }[] = [];
  if (!isFullyOff && staff.work_start && staff.work_end) {
    const beforeShift = getTimelineBlockPercent(timelineRange.startTime, staff.work_start, timelineRange);
    const afterShift = getTimelineBlockPercent(staff.work_end, timelineRange.endTime, timelineRange);

    if (beforeShift.widthPercent > 0) {
      offDutyRects.push(beforeShift);
    }
    if (afterShift.widthPercent > 0) {
      offDutyRects.push(afterShift);
    }
  } else if (isFullyOff) {
    offDutyRects.push({ leftPercent: 0, widthPercent: 100 });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          timelineMode === "expanded"
            ? `${staffColumnWidth}px minmax(${timelineMinWidth}px, 1fr)`
            : `${staffColumnWidth}px minmax(0, 1fr)`,
        width: "100%",
        minWidth: rowMinWidth,
      }}
    >
      <ScheduleStaffCell
        staff={staff}
        width={staffColumnWidth}
        onClick={onStaffClick ? () => onStaffClick(staff.staff_id) : undefined}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          minWidth: timelineMode === "expanded" ? timelineMinWidth : 0,
          height: rowHeight,
          backgroundColor: "var(--cs-surface-warm)",
          borderBottom: "1px solid var(--cs-border)",
          overflow: "hidden",
        }}
      >
        {/* Grid lines */}
        {hourMarks.map((mark) => {
          const left = ((mark.minutes - timelineRange.startMinutes) / timelineRange.totalMinutes) * 100;
          return (
            <div
              key={mark.minutes}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: mark.isBoundary ? "var(--cs-border)" : "var(--cs-border-soft)",
                zIndex: 1,
              }}
            />
          );
        })}

        {/* Off-duty overlays */}
        {offDutyRects.map((rect, i) => (
          <div
            key={`off-${i}`}
            style={{
              position: "absolute",
              left: `${rect.leftPercent}%`,
              width: `${rect.widthPercent}%`,
              top: 0,
              bottom: 0,
              backgroundColor: "rgba(200,190,180,0.28)",
              zIndex: 1,
            }}
          />
        ))}

        {/* Fully off label */}
        {isFullyOff && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                userSelect: "none",
              }}
            >
              OFF TODAY
            </span>
          </div>
        )}

        {/* Blocked times */}
        {staff.blocks.map((block, bi) => (
          <ScheduleBlockedTimeBlock
            key={`block-${bi}`}
            block={block}
            timelineRange={timelineRange}
            timelineMode={timelineMode}
          />
        ))}

        {/* Bookings */}
        {staff.bookings.map((booking) => (
          <ScheduleBookingBlock
            key={booking.id}
            booking={booking}
            branchResources={branchResources}
            date={date}
            onClick={onBookingClick}
            isSelected={selectedBookingId === booking.id}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
            timelineRange={timelineRange}
            timelineMode={timelineMode}
          />
        ))}
      </div>
    </div>
  );
}
