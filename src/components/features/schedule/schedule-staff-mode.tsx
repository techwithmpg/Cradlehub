"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Coffee, Car, Ban, CalendarDays } from "lucide-react";
import { ScheduleStaffProfileCard } from "./schedule-staff-profile-card";
import { ScheduleStaffSummaryCards } from "./schedule-staff-summary-cards";
import { ScheduleStaffDayList } from "./schedule-staff-day-list";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type ScheduleStaffModeProps = {
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  selectedBookingId: string | null;
  onBookingClick: (bookingId: string) => void;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function ScheduleStaffMode({
  staffRows,
  branchResources,
  selectedBookingId,
  onBookingClick,
}: ScheduleStaffModeProps) {
  const [selectedStaffIndex, setSelectedStaffIndex] = useState(0);

  const availableStaff = useMemo(
    () => staffRows.filter((s) => s.work_start && s.work_end),
    [staffRows]
  );

  const allStaff = staffRows.length > 0 ? staffRows : availableStaff;

  const selectedStaff = allStaff[selectedStaffIndex] ?? allStaff[0] ?? null;

  const handlePrev = () => {
    setSelectedStaffIndex((i) => (i > 0 ? i - 1 : allStaff.length - 1));
  };

  const handleNext = () => {
    setSelectedStaffIndex((i) => (i < allStaff.length - 1 ? i + 1 : 0));
  };

  const handleSelect = (staffId: string) => {
    const index = allStaff.findIndex((s) => s.staff_id === staffId);
    if (index >= 0) setSelectedStaffIndex(index);
  };

  if (!selectedStaff) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🌿</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>No staff scheduled</div>
        <div>There are no active staff members for the selected date.</div>
      </div>
    );
  }

  // Upcoming: same-day remaining bookings (active statuses, sorted by start time)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = selectedStaff.bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show" && b.status !== "completed")
    .filter((b) => timeToMinutes(b.start_time) >= nowMinutes)
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
    .slice(0, 3);

  // Today's summary numbers
  const isOff = !selectedStaff.work_start || !selectedStaff.work_end;
  const scheduledMinutes =
    !isOff && selectedStaff.work_start && selectedStaff.work_end
      ? timeToMinutes(selectedStaff.work_end) - timeToMinutes(selectedStaff.work_start)
      : 0;

  const breakMinutes = selectedStaff.blocks.reduce((sum, block) => {
    const reason = (block.reason ?? "").toLowerCase();
    if (reason.includes("break") || reason.includes("lunch")) {
      return sum + timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
    }
    return sum;
  }, 0);

  const blockedMinutes = selectedStaff.blocks.reduce((sum, block) => {
    const reason = (block.reason ?? "").toLowerCase();
    if (!reason.includes("break") && !reason.includes("lunch")) {
      return sum + timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
    }
    return sum;
  }, 0);

  const travelMinutes = selectedStaff.bookings.reduce((sum, b) => {
    if (b.type === "home_service" && b.status !== "cancelled" && b.status !== "no_show") {
      return sum + 30;
    }
    return sum;
  }, 0);

  const summaryItems = [
    { label: "Schedule Time", value: formatMinutes(scheduledMinutes), icon: Clock },
    { label: "Break Time", value: formatMinutes(breakMinutes), icon: Coffee },
    { label: "Travel Time", value: formatMinutes(travelMinutes), icon: Car },
    { label: "Blocked Time", value: formatMinutes(blockedMinutes), icon: Ban },
    {
      label: "Total Time",
      value: formatMinutes(scheduledMinutes + travelMinutes),
      icon: CalendarDays,
      highlight: true,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
      {/* Select Staff bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cs-text-muted)",
          }}
        >
          Select Staff
        </span>

        <button
          type="button"
          onClick={handlePrev}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Previous staff"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <select
          value={selectedStaff.staff_id}
          onChange={(e) => handleSelect(e.target.value)}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
            minWidth: 180,
          }}
        >
          {allStaff.map((s) => (
            <option key={s.staff_id} value={s.staff_id}>
              {s.staff_name}
              {s.work_start && s.work_end ? "" : " (Off)"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleNext}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Next staff"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Profile + Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "0.75rem", alignItems: "start" }}>
        <ScheduleStaffProfileCard staff={selectedStaff} branchResources={branchResources} />
        <ScheduleStaffSummaryCards staff={selectedStaff} />
      </div>

      {/* Today's Schedule */}
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cs-text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Today’s Schedule
        </div>
        <ScheduleStaffDayList
          staff={selectedStaff}
          selectedBookingId={selectedBookingId}
          onBookingClick={onBookingClick}
        />
      </div>

      {/* Upcoming Bookings */}
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "0.875rem 1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cs-text-muted)",
            marginBottom: "0.625rem",
          }}
        >
          Upcoming Bookings
        </div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
            No remaining bookings for this staff today.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcoming.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onBookingClick(b.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.5rem 0.625rem",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                  backgroundColor: "var(--cs-bg)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor:
                        b.status === "confirmed"
                          ? "#4A7C59"
                          : b.status === "in_progress"
                            ? "#7E57C2"
                            : b.status === "pending"
                              ? "#F59E0B"
                              : "#BDBDBD",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--cs-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.start_time.slice(0, 5)} — {b.service}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--cs-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {b.customer}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Today’s Summary */}
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "0.875rem 1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cs-text-muted)",
            marginBottom: "0.625rem",
          }}
        >
          Today’s Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem" }}>
          {summaryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  backgroundColor: item.highlight ? "var(--cs-bg)" : "transparent",
                  border: item.highlight ? "1px solid var(--cs-border)" : "1px solid var(--cs-border-soft)",
                  borderRadius: 8,
                  padding: "0.625rem 0.75rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", marginBottom: 4 }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: item.highlight ? "var(--cs-sand)" : "var(--cs-text)",
                    fontFamily: "var(--font-playfair, serif)",
                  }}
                >
                  {item.value}
                </div>
              </div>
          ))}
        </div>
      </div>

      {/* Weekly Workload — placeholder */}
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1.5rem 1rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cs-text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Weekly Workload
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
          Weekly workload will be available after weekly schedule data is connected.
        </div>
      </div>
    </div>
  );
}
