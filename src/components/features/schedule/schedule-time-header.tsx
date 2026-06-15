"use client";

import {
  getHeaderHeightPx,
  getTimelineHourMarks,
  type TimelineDisplayMode,
  type TimelineRange,
} from "@/lib/utils/schedule-timeline";
import { useScheduleDensity } from "./schedule-density";

type ScheduleTimeHeaderProps = {
  timelineRange: TimelineRange;
  timelineMode: TimelineDisplayMode;
  staffColumnWidth: number;
  timelineMinWidth: number;
};

export function ScheduleTimeHeader({
  timelineRange,
  timelineMode,
  staffColumnWidth,
  timelineMinWidth,
}: ScheduleTimeHeaderProps) {
  const { density } = useScheduleDensity();
  const headerHeight = getHeaderHeightPx(density);
  const hourMarks = getTimelineHourMarks(timelineRange);
  const labelIntervalHours = timelineMode === "fit" && timelineRange.hourCount > 10 ? 2 : 1;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${staffColumnWidth}px minmax(0, 1fr)`,
        height: headerHeight,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 3,
        backgroundColor: "var(--cs-surface)",
        borderBottom: "1px solid var(--cs-border)",
        width: "100%",
        minWidth: timelineMode === "expanded" ? staffColumnWidth + timelineMinWidth : undefined,
      }}
    >
      {/* Corner spacer */}
      <div
        style={{
          width: staffColumnWidth,
          flexShrink: 0,
          borderRight: "1px solid var(--cs-border)",
          position: "sticky",
          left: 0,
          zIndex: 5,
          backgroundColor: "var(--cs-surface)",
        }}
      />

      {/* Time labels */}
      <div
        style={{
          position: "relative",
          minWidth: timelineMode === "expanded" ? timelineMinWidth : 0,
          width: "100%",
          overflow: "hidden",
        }}
      >
        {hourMarks.map((mark, index) => {
          const elapsedHours = Math.round((mark.minutes - timelineRange.startMinutes) / 60);
          const isLast = index === hourMarks.length - 1;
          const showLabel =
            timelineMode === "expanded" ||
            index === 0 ||
            (!isLast && elapsedHours % labelIntervalHours === 0) ||
            (isLast && timelineRange.hourCount <= 10);
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
            }}
          >
            {showLabel && (
              <span
                style={{
                  position: "absolute",
                  left: isLast ? undefined : 6,
                  right: isLast ? 6 : undefined,
                  bottom: 6,
                  width: timelineMode === "fit" ? 54 : 72,
                  fontSize: timelineMode === "fit" && timelineRange.hourCount > 10 ? "0.625rem" : "0.6875rem",
                  color: "var(--cs-text-muted)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mark.label}
              </span>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
