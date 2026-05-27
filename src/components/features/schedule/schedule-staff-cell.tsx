"use client";

import {
  STAFF_CELL_WIDTH_PX,
  formatScheduleTime,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { useScheduleDensity } from "./schedule-density";

type StaffCellProps = {
  staff: DailyScheduleStaffRow;
  onClick?: () => void;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatStaffLabel(staff: DailyScheduleStaffRow): string {
  if (!staff.staff_tier) return "Service Staff";
  const tier = staff.staff_tier.toLowerCase();
  if (tier === "senior") return "Senior Therapist";
  if (tier === "mid") return "Therapist";
  if (tier === "junior") return "Junior Therapist";
  return staff.staff_tier.charAt(0).toUpperCase() + staff.staff_tier.slice(1);
}

export function ScheduleStaffCell({ staff, onClick }: StaffCellProps) {
  const { metrics } = useScheduleDensity();
  const rowHeight = metrics.rowHeight;
  const isOff = !staff.work_start || !staff.work_end;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      style={{
        width: STAFF_CELL_WIDTH_PX,
        height: rowHeight,
        flexShrink: 0,
        backgroundColor: isOff ? "var(--cs-bg)" : "var(--cs-surface)",
        borderRight: "1px solid var(--cs-border)",
        borderBottom: "1px solid var(--cs-border)",
        padding: `${metrics.staffCellPadding}px ${metrics.gap + 4}px`,
        display: "flex",
        alignItems: "center",
        gap: `${metrics.gap}px`,
        position: "sticky",
        left: 0,
        zIndex: 4,
        cursor: onClick ? "pointer" : "default",
        transition: onClick ? "background 0.12s" : undefined,
      }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isOff ? "var(--cs-border-soft)" : "var(--cs-surface-warm)"; } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isOff ? "var(--cs-bg)" : "var(--cs-surface)"; } : undefined}
    >
      {/* Avatar */}
      <div
        style={{
          width: metrics.avatarSize,
          height: metrics.avatarSize,
          borderRadius: "50%",
          backgroundColor: isOff ? "#E5E0DB" : "#E8F5E9",
          color: isOff ? "#8A7A6A" : "#4A7C59",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: metrics.avatarSize > 30 ? "0.75rem" : "0.625rem",
          fontWeight: 700,
          flexShrink: 0,
          fontFamily: "var(--font-playfair, serif)",
        }}
      >
        {getInitials(staff.staff_name)}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: `${metrics.fontSize}rem`,
            fontWeight: 600,
            color: isOff ? "var(--cs-text-muted)" : "var(--cs-text)",
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
            fontSize: `${metrics.fontSize - 0.125}rem`,
            color: "var(--cs-text-muted)",
            marginTop: 1,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {formatStaffLabel(staff)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: metrics.avatarSize <= 24 ? 1 : 3,
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
              fontSize: `${metrics.fontSize - 0.125}rem`,
              color: isOff ? "var(--cs-text-muted)" : "#4A7C59",
              fontWeight: 500,
            }}
          >
            {isOff
              ? "Off today"
              : `${formatScheduleTime(staff.work_start!)} – ${formatScheduleTime(staff.work_end!)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
