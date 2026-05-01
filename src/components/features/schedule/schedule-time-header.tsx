"use client";

import {
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  SLOT_WIDTH_PX,
  STAFF_CELL_WIDTH_PX,
  HEADER_HEIGHT_PX,
  formatScheduleTime,
} from "@/lib/utils/schedule-timeline";

export function ScheduleTimeHeader() {
  const slots: { label: string; isHour: boolean }[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
    slots.push({ label: formatScheduleTime(`${String(h).padStart(2, "0")}:00`), isHour: true });
    slots.push({ label: "", isHour: false });
  }
  slots.push({ label: formatScheduleTime(`${String(TIMELINE_END_HOUR).padStart(2, "0")}:00`), isHour: true });

  return (
    <div
      style={{
        display: "flex",
        height: HEADER_HEIGHT_PX,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 3,
        backgroundColor: "var(--cs-surface)",
        borderBottom: "1px solid var(--cs-border)",
      }}
    >
      {/* Corner spacer */}
      <div
        style={{
          width: STAFF_CELL_WIDTH_PX,
          flexShrink: 0,
          borderRight: "1px solid var(--cs-border)",
          position: "sticky",
          left: 0,
          zIndex: 5,
          backgroundColor: "var(--cs-surface)",
        }}
      />

      {/* Time labels */}
      <div style={{ display: "flex", position: "relative" }}>
        {slots.map((slot, i) => (
          <div
            key={i}
            style={{
              width: SLOT_WIDTH_PX,
              flexShrink: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
              paddingBottom: 6,
              paddingLeft: 6,
              borderRight: slot.isHour
                ? "1px solid var(--cs-border)"
                : "1px dashed var(--cs-border-soft)",
              fontSize: "0.6875rem",
              color: slot.isHour ? "var(--cs-text-muted)" : "transparent",
              fontWeight: slot.isHour ? 600 : 400,
              position: "relative",
            }}
          >
            {slot.label}
          </div>
        ))}
      </div>
    </div>
  );
}
