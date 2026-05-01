"use client";

import {
  ROW_HEIGHT_PX,
  SLOT_WIDTH_PX,
  SLOT_MINUTES,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  getTimelineTotalWidthPx,
  timeToMinutes,
} from "@/lib/utils/schedule-timeline";
import { ScheduleStaffCell } from "./schedule-staff-cell";
import { ScheduleBookingBlock } from "./schedule-booking-block";
import { ScheduleBlockedTimeBlock } from "./schedule-blocked-time-block";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";

type StaffRowProps = {
  staff: DailyScheduleStaffRow;
};

export function ScheduleStaffRow({ staff }: StaffRowProps) {
  const totalWidth = getTimelineTotalWidthPx();
  const isFullyOff = !staff.work_start || !staff.work_end;

  const workStartMin = staff.work_start ? timeToMinutes(staff.work_start) : null;
  const workEndMin = staff.work_end ? timeToMinutes(staff.work_end) : null;

  // Pre-compute off-duty segments
  const offDutyRects: { left: number; width: number }[] = [];
  if (!isFullyOff && workStartMin !== null && workEndMin !== null) {
    const startPx = ((workStartMin - TIMELINE_START_HOUR * 60) / SLOT_MINUTES) * SLOT_WIDTH_PX;
    const endPx = ((workEndMin - TIMELINE_START_HOUR * 60) / SLOT_MINUTES) * SLOT_WIDTH_PX;

    if (startPx > 0) {
      offDutyRects.push({ left: 0, width: startPx });
    }
    if (endPx < totalWidth) {
      offDutyRects.push({ left: endPx, width: totalWidth - endPx });
    }
  } else if (isFullyOff) {
    offDutyRects.push({ left: 0, width: totalWidth });
  }

  return (
    <div style={{ display: "flex" }}>
      <ScheduleStaffCell staff={staff} />

      <div
        style={{
          position: "relative",
          width: totalWidth,
          height: ROW_HEIGHT_PX,
          flexShrink: 0,
          backgroundColor: "var(--cs-surface-warm)",
          borderBottom: "1px solid var(--cs-border)",
        }}
      >
        {/* Grid lines */}
        {Array.from({ length: (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 2 + 1 }).map((_, i) => {
          const isHour = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * SLOT_WIDTH_PX,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: isHour ? "var(--cs-border)" : "var(--cs-border-soft)",
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
              left: rect.left,
              width: rect.width,
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
          <ScheduleBlockedTimeBlock key={`block-${bi}`} block={block} />
        ))}

        {/* Bookings */}
        {staff.bookings.map((booking) => (
          <ScheduleBookingBlock key={booking.id} booking={booking} />
        ))}
      </div>
    </div>
  );
}
