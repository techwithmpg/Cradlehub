"use client";

import {
  STAFF_CELL_WIDTH_PX,
  ROW_HEIGHT_PX,
  formatScheduleTime,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";

type StaffCellProps = {
  staff: DailyScheduleStaffRow;
};

export function ScheduleStaffCell({ staff }: StaffCellProps) {
  const isOff = !staff.work_start || !staff.work_end;

  return (
    <div
      style={{
        width: STAFF_CELL_WIDTH_PX,
        height: ROW_HEIGHT_PX,
        flexShrink: 0,
        backgroundColor: "var(--cs-surface)",
        borderRight: "1px solid var(--cs-border)",
        borderBottom: "1px solid var(--cs-border)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "sticky",
        left: 0,
        zIndex: 4,
      }}
    >
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}
      >
        {staff.staff_name}
      </div>
      <div
        style={{
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted)",
          marginTop: 2,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {staff.staff_tier ?? "Staff"}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 4,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: isOff ? "#BDBDBD" : "#4A7C59",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.6875rem",
            color: isOff ? "var(--cs-text-muted)" : "#4A7C59",
            fontWeight: 500,
          }}
        >
          {isOff
            ? "Off"
            : `${formatScheduleTime(staff.work_start!)} – ${formatScheduleTime(staff.work_end!)}`}
        </span>
      </div>
    </div>
  );
}
