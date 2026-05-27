"use client";

/**
 * ScheduleStaffGroup
 *
 * Collapsible group header + staff rows for the daily schedule board.
 * Groups staff by operational status (In Progress, Scheduled, Off Today).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import { ScheduleStaffRow } from "./schedule-staff-row";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

export type StaffGroupKey = "in_progress" | "scheduled" | "off_today";

export const GROUP_META: Record<StaffGroupKey, { label: string; color: string; bg: string; dot: string }> = {
  in_progress: {
    label: "In Progress",
    color: "#92400E",
    bg: "#FFF7ED",
    dot: "#D97706",
  },
  scheduled: {
    label: "Scheduled Today",
    color: "#065F46",
    bg: "#ECFDF5",
    dot: "#059669",
  },
  off_today: {
    label: "Off Today",
    color: "#6B7280",
    bg: "#F9FAFB",
    dot: "#9CA3AF",
  },
};

export function classifyStaffGroup(staff: DailyScheduleStaffRow): StaffGroupKey {
  const hasInProgress = staff.bookings.some((b) => b.status === "in_progress");
  if (hasInProgress) return "in_progress";
  const isOff = !staff.work_start || !staff.work_end;
  if (isOff) return "off_today";
  return "scheduled";
}

type ScheduleStaffGroupProps = {
  groupKey: StaffGroupKey;
  staffList: DailyScheduleStaffRow[];
  branchResources?: ResourceRow[];
  date?: string;
  defaultExpanded?: boolean;
  onBookingClick?: (bookingId: string) => void;
  selectedBookingId?: string | null;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  onStaffClick?: (staffId: string) => void;
};

export function ScheduleStaffGroup({
  groupKey,
  staffList,
  branchResources,
  date,
  defaultExpanded = true,
  onBookingClick,
  selectedBookingId,
  onHoverEnter,
  onHoverLeave,
  onStaffClick,
}: ScheduleStaffGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const meta = GROUP_META[groupKey];

  if (staffList.length === 0) return null;

  return (
    <div>
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: meta.bg,
          borderBottom: "1px solid var(--cs-border-soft)",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          border: "none",
          fontFamily: "inherit",
        }}
      >
        {expanded ? (
          <ChevronDown size={14} style={{ color: meta.color, flexShrink: 0 }} />
        ) : (
          <ChevronRight size={14} style={{ color: meta.color, flexShrink: 0 }} />
        )}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: meta.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: meta.color,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: meta.color,
            opacity: 0.7,
            marginLeft: 4,
          }}
        >
          ({staffList.length})
        </span>
      </button>

      {/* Staff rows */}
      {expanded && (
        <div>
          {staffList.map((staff) => (
            <ScheduleStaffRow
              key={staff.staff_id}
              staff={staff}
              branchResources={branchResources}
              date={date}
              onBookingClick={onBookingClick}
              selectedBookingId={selectedBookingId}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onStaffClick={onStaffClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
