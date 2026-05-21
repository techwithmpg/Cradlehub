"use client";

import { useState } from "react";
import { CrmAvailabilityBoard } from "./crm-availability-board";
import type { CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

type Tab = "live_board" | "staff_list" | "schedule_issues" | "driver_readiness";

const TABS: { id: Tab; label: string }[] = [
  { id: "live_board",       label: "Live Board" },
  { id: "staff_list",       label: "Staff List" },
  { id: "schedule_issues",  label: "Schedule Issues" },
  { id: "driver_readiness", label: "Driver Readiness" },
];

function formatTime(t: string | null): string {
  if (!t) return "—";
  const parts = t.slice(0, 5).split(":");
  if (parts.length < 2) return t;
  const [h, m] = parts;
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

/** Formats an ISO timestamp to a locale-neutral 12-hour time string.
 *  Uses manual extraction so server and client always produce identical output. */
function formatAsOf(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const SHIFT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  opening: { label: "Opening",  bg: "rgba(74,124,89,0.12)",  color: "#4A7C59" },
  closing: { label: "Closing",  bg: "rgba(59,130,246,0.12)", color: "#2563EB" },
  single:  { label: "Regular",  bg: "rgba(107,114,128,0.1)", color: "var(--cs-text-muted)" },
};

const STATUS_DOT: Record<string, string> = {
  available_now: "var(--cs-success)",
  busy_now:      "var(--cs-info)",
  off_today:     "var(--cs-text-muted)",
  no_schedule:   "var(--cs-warning)",
};

const STATUS_LABEL: Record<string, string> = {
  available_now: "Available",
  busy_now:      "Busy",
  off_today:     "Off",
  no_schedule:   "No Schedule",
};

type Props = { snapshot: CrmAvailabilitySnapshot };

export function CrmAvailabilityClient({ snapshot }: Props) {
  const [tab, setTab] = useState<Tab>("live_board");

  const issueCount  = snapshot.staff.filter((s) => s.scheduleStatus === "no_schedule").length;
  const driverCount = snapshot.staff.filter((s) => s.is_driver).length;

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex", gap: 2, borderBottom: "1px solid var(--cs-border-soft)",
          marginBottom: "1rem",
        }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const badge =
            t.id === "schedule_issues"  ? (issueCount > 0  ? issueCount  : null) :
            t.id === "driver_readiness" ? (driverCount > 0 ? driverCount : null) :
            null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 14px", fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--cs-text)" : "var(--cs-text-muted)",
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid var(--cs-sand)" : "2px solid transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: -1,
              }}
            >
              {t.label}
              {badge !== null && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: t.id === "schedule_issues" ? "var(--cs-warning)" : "var(--cs-info)",
                    color: "var(--cs-text-inverse)", fontSize: 10, fontWeight: 600, padding: "0 5px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {tab === "live_board" && (
        <CrmAvailabilityBoard staff={snapshot.staff} />
      )}

      {tab === "staff_list" && (
        <StaffListView staff={snapshot.staff} />
      )}

      {tab === "schedule_issues" && (
        <ScheduleIssuesView staff={snapshot.staff} />
      )}

      {tab === "driver_readiness" && (
        <DriverReadinessView staff={snapshot.staff} />
      )}

      {/* Footer note */}
      <div style={{ marginTop: "1rem", fontSize: 11, color: "var(--cs-text-muted)" }}>
        As of {formatAsOf(snapshot.asOf)}.
        Schedule-based — does not reflect physical check-in.
      </div>
    </div>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────────────────

import type { CrmAvailabilityStaffRow } from "@/lib/queries/crm-availability";

function StaffListView({ staff }: { staff: CrmAvailabilityStaffRow[] }) {
  return (
    <div style={{ border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", overflow: "hidden" }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 80px 140px 1fr",
          gap: 12, padding: "8px 14px",
          background: "var(--cs-surface-raised)", borderBottom: "1px solid var(--cs-border-soft)",
          fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}
      >
        <span>Staff</span>
        <span>Status</span>
        <span>Shift</span>
        <span>Active Booking</span>
      </div>
      {staff.map((s) => {
        const dot = STATUS_DOT[s.liveStatus] ?? "var(--cs-text-muted)";
        const label = STATUS_LABEL[s.liveStatus] ?? s.liveStatus;
        const primaryShift = s.shifts[0];
        const shiftType = primaryShift?.shift_type ?? "single";
        const shiftCfg = SHIFT_BADGE[shiftType] ?? SHIFT_BADGE.single!;
        return (
          <div
            key={s.staff_id}
            style={{
              display: "grid", gridTemplateColumns: "1fr 80px 140px 1fr",
              alignItems: "center", gap: 12,
              padding: "10px 14px", borderBottom: "1px solid var(--cs-border-soft)", fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontWeight: 500, color: "var(--cs-text)" }}>{s.staff_name}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 1, textTransform: "capitalize" }}>
                {s.staff_type.replace("_", " ")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: dot, fontWeight: 500 }}>{label}</span>
            </div>
            <div>
              {s.work_start && s.work_end ? (
                <div>
                  <span
                    style={{
                      display: "inline-block", padding: "1px 7px",
                      borderRadius: 10, fontSize: 10, fontWeight: 500,
                      background: shiftCfg.bg, color: shiftCfg.color, marginBottom: 2,
                    }}
                  >
                    {shiftCfg.label}
                  </span>
                  <div style={{ fontSize: 11, color: "var(--cs-text-subtle)" }}>
                    {formatTime(s.work_start)} – {formatTime(s.work_end)}
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>—</span>
              )}
            </div>
            <div style={{ fontSize: 12 }}>
              {s.active_booking ? (
                <div>
                  <span style={{ color: "var(--cs-text)" }}>{s.active_booking.service}</span>
                  <span style={{ color: "var(--cs-text-muted)", marginLeft: 6 }}>{s.active_booking.customer}</span>
                </div>
              ) : s.liveStatus === "available_now" ? (
                <span style={{ color: "var(--cs-success)", fontSize: 11 }}>Free</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleIssuesView({ staff }: { staff: CrmAvailabilityStaffRow[] }) {
  const issues = staff.filter((s) => s.scheduleStatus === "no_schedule");
  if (issues.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--cs-text-muted)", fontSize: 13 }}>
        No schedule issues today. All staff have a weekly pattern set.
      </div>
    );
  }
  return (
    <div>
      <div style={{ marginBottom: "0.75rem", fontSize: 12, color: "var(--cs-text-muted)" }}>
        Staff without a weekly schedule set. These staff members will not appear in the booking engine.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
        {issues.map((s) => (
          <div
            key={s.staff_id}
            style={{
              border: "1px solid var(--cs-warning)",
              borderRadius: "var(--cs-r-md)", padding: "12px 14px",
              background: "var(--cs-surface)",
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 13, color: "var(--cs-text)" }}>{s.staff_name}</div>
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2, textTransform: "capitalize" }}>
              {s.staff_type.replace("_", " ")}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--cs-warning)", display: "flex", alignItems: "center", gap: 4 }}>
              <span>⚠</span>
              No weekly schedule set
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverReadinessView({ staff }: { staff: CrmAvailabilityStaffRow[] }) {
  const drivers = staff.filter((s) => s.is_driver);
  if (drivers.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--cs-text-muted)", fontSize: 13 }}>
        No drivers found for this branch.
      </div>
    );
  }
  const ready = drivers.filter((s) => s.liveStatus === "available_now");
  const off   = drivers.filter((s) => s.liveStatus !== "available_now" && s.liveStatus !== "busy_now");

  return (
    <div>
      <div style={{ marginBottom: "0.75rem", fontSize: 12, color: "var(--cs-text-muted)" }}>
        {ready.length} of {drivers.length} driver{drivers.length !== 1 ? "s" : ""} schedule-ready.
        Schedule-based — does not reflect live GPS or check-in status.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
        {drivers.map((s) => {
          const isReady = s.liveStatus === "available_now";
          const isBusy  = s.liveStatus === "busy_now";
          const dotColor = isReady ? "var(--cs-success)" : isBusy ? "var(--cs-info)" : "var(--cs-text-muted)";
          const statusLabel = isReady ? "Schedule-ready" : isBusy ? "On trip" : "Off / No schedule";
          return (
            <div
              key={s.staff_id}
              style={{
                border: `1px solid ${isReady ? "var(--cs-success)" : "var(--cs-border-soft)"}`,
                borderRadius: "var(--cs-r-md)", padding: "12px 14px",
                background: "var(--cs-surface)",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--cs-text)" }}>{s.staff_name}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>Driver</div>
              {s.work_start && s.work_end && (
                <div style={{ fontSize: 11, color: "var(--cs-text-subtle)", marginTop: 4 }}>
                  {formatTime(s.work_start)} – {formatTime(s.work_end)}
                </div>
              )}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: dotColor, fontWeight: 500 }}>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Off section */}
      {off.length > 0 && (
        <div style={{ marginTop: "1rem", fontSize: 11, color: "var(--cs-text-muted)" }}>
          {off.map((s) => s.staff_name).join(", ")} — off or no schedule today.
        </div>
      )}
    </div>
  );
}
