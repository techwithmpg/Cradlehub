"use client";

import { DailyScheduleBoard } from "./daily-schedule-board";
import { ScheduleLegend } from "./schedule-legend";
import { ScheduleModeSwitcher, type ScheduleViewMode } from "./schedule-mode-switcher";
import { ScheduleStaffMode } from "./schedule-staff-mode";
import { ScheduleWeekMode } from "./schedule-week-mode";
import type { TimelineDisplayMode } from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type ScheduleBoardPanelProps = {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  onBookingClick: (bookingId: string) => void;
  selectedBookingId: string | null;
  viewMode: ScheduleViewMode;
  onViewModeChange: (mode: ScheduleViewMode) => void;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  onScheduleAdjusted?: (feedback: { title: string; description?: string; variant?: "success" | "error" }) => void;
  onStaffClick?: (staffId: string) => void;
  showHeader?: boolean;
  timelineMode?: TimelineDisplayMode;
};

export function ScheduleBoardPanel({
  branchId,
  branchName,
  date,
  staffRows,
  branchResources,
  onBookingClick,
  selectedBookingId,
  viewMode,
  onViewModeChange,
  onHoverEnter,
  onHoverLeave,
  onScheduleAdjusted,
  onStaffClick,
  showHeader = true,
  timelineMode = "expanded",
}: ScheduleBoardPanelProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      {/* Panel header */}
      {showHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.625rem 0.875rem",
            borderBottom: "1px solid var(--cs-border)",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>{branchName}</span>
            <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
              {new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
            {viewMode === "day" && (
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-sand)",
                  backgroundColor: "var(--cs-bg)",
                  padding: "2px 8px",
                  borderRadius: 100,
                }}
              >
                Daily timeline
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {viewMode === "day" && <ScheduleLegend />}
            <ScheduleModeSwitcher mode={viewMode} onChange={onViewModeChange} />
          </div>
        </div>
      )}

      {/* Body — mode dependent */}
      {viewMode === "day" && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <DailyScheduleBoard
            date={date}
            staffRows={staffRows}
            branchResources={branchResources}
            onBookingClick={onBookingClick}
            selectedBookingId={selectedBookingId}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
            onStaffClick={onStaffClick}
            timelineMode={timelineMode}
          />
        </div>
      )}

      {viewMode === "staff" && (
        <div style={{ padding: "0.875rem" }}>
          <ScheduleStaffMode
            branchId={branchId}
            date={date}
            staffRows={staffRows}
            branchResources={branchResources}
            selectedBookingId={selectedBookingId}
            onBookingClick={onBookingClick}
            onScheduleAdjusted={onScheduleAdjusted}
          />
        </div>
      )}

      {viewMode === "week" && (
        <div style={{ padding: "0.875rem" }}>
          <ScheduleWeekMode
            staffRows={staffRows}
            branchResources={branchResources}
            date={date}
            selectedBookingId={selectedBookingId}
            onBookingClick={onBookingClick}
            onViewModeChange={onViewModeChange}
          />
        </div>
      )}
    </div>
  );
}
