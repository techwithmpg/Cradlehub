"use client";

import {
  getCurrentTimePercent,
  type TimelineDisplayMode,
  type TimelineRange,
} from "@/lib/utils/schedule-timeline";

type ScheduleCurrentTimeIndicatorProps = {
  timelineRange: TimelineRange;
  timelineMode: TimelineDisplayMode;
  staffColumnWidth: number;
  timelineMinWidth: number;
};

export function ScheduleCurrentTimeIndicator({
  timelineRange,
  timelineMode,
  staffColumnWidth,
  timelineMinWidth,
}: ScheduleCurrentTimeIndicatorProps) {
  const left = getCurrentTimePercent(timelineRange);
  if (left === null) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns:
          timelineMode === "expanded"
            ? `${staffColumnWidth}px minmax(${timelineMinWidth}px, 1fr)`
            : `${staffColumnWidth}px minmax(0, 1fr)`,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          gridColumn: 2,
          position: "relative",
          minWidth: timelineMode === "expanded" ? timelineMinWidth : 0,
          width: "100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${left}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "#C7A27C",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "#C7A27C",
              color: "#fff",
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              letterSpacing: "0.04em",
            }}
          >
            Now
          </div>
        </div>
      </div>
    </div>
  );
}
