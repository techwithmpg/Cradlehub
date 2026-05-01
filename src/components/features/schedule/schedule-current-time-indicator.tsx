"use client";

import { getCurrentTimePx } from "@/lib/utils/schedule-timeline";

export function ScheduleCurrentTimeIndicator() {
  const left = getCurrentTimePx();
  if (left === null) return null;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: "#C7A27C",
        zIndex: 5,
        pointerEvents: "none",
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
  );
}
