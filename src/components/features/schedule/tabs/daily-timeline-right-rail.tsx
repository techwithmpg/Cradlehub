"use client";

import { Zap, Users, AlertCircle, Shield } from "lucide-react";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleActionTile } from "../workspace/schedule-action-tile";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";

export function DailyTimelineRightRail({
  staffRows,
  alertList,
}: {
  staffRows: DailyScheduleStaffRow[];
  alertList: { id: string; type: string; title: string; description: string }[];
}) {
  const availableNow = staffRows.filter((s) => s.work_start && s.work_end && s.bookings.every((b) => b.status !== "in_progress"));
  const inProgress = staffRows.filter((s) => s.bookings.some((b) => b.status === "in_progress"));
  const offToday = staffRows.filter((s) => !s.work_start || !s.work_end);

  // Coverage health: % of scheduled staff who are available or busy (i.e., have work hours)
  const scheduledCount = staffRows.filter((s) => s.work_start && s.work_end).length;
  const coveragePct = staffRows.length > 0 ? Math.round((scheduledCount / staffRows.length) * 100) : 0;

  return (
    <>
      {/* Quick Actions */}
      <SchedulePanel
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={16} style={{ color: "var(--cs-sand)" }} />
            Quick Actions
          </span>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <ScheduleActionTile label="Add Booking" href="/crm/bookings/new" primary />
          <ScheduleActionTile label="Block Staff Time" href="/crm/schedule" />
          <ScheduleActionTile label="Check Availability" href="/crm/availability" />
          <ScheduleActionTile label="Open Schedule Setup" href="/crm/staff-availability" />
        </div>
      </SchedulePanel>

      {/* Coverage Health */}
      <SchedulePanel
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={16} style={{ color: "var(--cs-crm-accent)" }} />
            Coverage Health
          </span>
        }
      >
        <div style={{ marginBottom: "0.75rem" }}>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "var(--cs-surface-warm)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${coveragePct}%`,
                background:
                  coveragePct >= 80
                    ? "var(--cs-success)"
                    : coveragePct >= 50
                    ? "var(--cs-warning)"
                    : "var(--cs-error)",
                borderRadius: 4,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
            }}
          >
            <span>{coveragePct}% coverage</span>
            <span>
              {scheduledCount}/{staffRows.length} scheduled
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {[
            { label: "Available", value: availableNow.length, color: "var(--cs-success)" },
            { label: "In Progress", value: inProgress.length, color: "var(--cs-sand)" },
            { label: "Off Today", value: offToday.length, color: "var(--cs-text-muted)" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.4rem 0.5rem",
                borderRadius: "var(--cs-r-sm)",
                background: "var(--cs-surface-warm)",
              }}
            >
              <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </SchedulePanel>

      {/* Available Staff Now */}
      <SchedulePanel
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: "var(--cs-sand)" }} />
            Available Staff Now
          </span>
        }
        action={
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>
            {availableNow.length} total
          </span>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {availableNow.slice(0, 6).map((staff) => (
            <div
              key={staff.staff_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.4rem 0.5rem",
                borderRadius: "var(--cs-r-sm)",
                background: "var(--cs-surface-warm)",
              }}
            >
              <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{staff.staff_name}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                {staff.work_start} – {staff.work_end}
              </span>
            </div>
          ))}
          {availableNow.length === 0 && (
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>No staff available right now</span>
          )}
          {availableNow.length > 6 && (
            <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", textAlign: "center", padding: "0.25rem" }}>
              +{availableNow.length - 6} more
            </span>
          )}
        </div>
      </SchedulePanel>

      {/* Schedule Alerts */}
      {alertList.length > 0 && (
        <SchedulePanel
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} style={{ color: "var(--cs-error)" }} />
              Schedule Alerts
            </span>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {alertList.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--cs-r-sm)",
                  background:
                    alert.type === "room_conflict"
                      ? "var(--cs-error-bg)"
                      : alert.type === "travel_buffer"
                      ? "var(--cs-warning-bg)"
                      : "var(--cs-info-bg)",
                  border: `1px solid ${
                    alert.type === "room_conflict"
                      ? "var(--cs-error)"
                      : alert.type === "travel_buffer"
                      ? "var(--cs-warning)"
                      : "var(--cs-info)"
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color:
                      alert.type === "room_conflict"
                        ? "var(--cs-error)"
                        : alert.type === "travel_buffer"
                        ? "var(--cs-warning)"
                        : "var(--cs-info)",
                  }}
                >
                  {alert.title}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {alert.description}
                </div>
              </div>
            ))}
          </div>
        </SchedulePanel>
      )}
    </>
  );
}
