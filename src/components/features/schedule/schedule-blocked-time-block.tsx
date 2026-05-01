"use client";

import {
  getTimelineOffsetPx,
  getTimelineWidthPx,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleBlock } from "@/lib/queries/schedule";

type BlockedTimeBlockProps = {
  block: DailyScheduleBlock;
};

export function ScheduleBlockedTimeBlock({ block }: BlockedTimeBlockProps) {
  const left = getTimelineOffsetPx(block.start_time);
  const width = getTimelineWidthPx(block.start_time, block.end_time);
  const minWidth = 48;
  const effectiveWidth = Math.max(width, minWidth);

  return (
    <div
      title={block.reason || "Blocked time"}
      style={{
        position: "absolute",
        left,
        width: effectiveWidth,
        top: 8,
        bottom: 8,
        backgroundColor: "#F0EDE8",
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(180,170,155,0.18) 6px, rgba(180,170,155,0.18) 12px)",
        border: "1.5px dashed #BFB4AA",
        borderRadius: 6,
        padding: "4px 6px",
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: "0.6875rem",
          color: "#8A7A6A",
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {block.reason || "Blocked"}
      </span>
    </div>
  );
}
