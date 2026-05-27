"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CrmAvailabilityBoard } from "./crm-availability-board";
import { ShiftTypeBadge } from "@/components/shared/shift-type-badge";
import { PresenceStatusBadge } from "@/components/shared/presence-status-badge";
import { AvailabilityStatusBadge } from "@/components/shared/availability-status-badge";
import { formatTime12h } from "@/lib/utils/time-format";
import { checkInStaffForShiftAction, checkOutStaffForShiftAction } from "@/lib/actions/staff-checkins";
import type { CrmAvailabilitySnapshot, CrmAvailabilityStaffRow } from "@/lib/queries/crm-availability";
import { ReadinessIssueCard } from "@/components/shared/readiness-issue-card";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import {
  buildServiceStaffNoScheduleIssue,
  buildOpsStaffNoScheduleIssue,
} from "./availability-readiness-utils";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";

type Tab = "live_board" | "staff_list" | "schedule_issues" | "driver_readiness";

const TABS: { id: Tab; label: string }[] = [
  { id: "live_board",       label: "Live Board" },
  { id: "staff_list",       label: "Staff List" },
  { id: "schedule_issues",  label: "Schedule Issues" },
  { id: "driver_readiness", label: "Driver Readiness" },
];

/** Deterministic 12-hour time from ISO string — avoids locale-based hydration mismatch. */
function formatAsOf(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

type Props = { snapshot: CrmAvailabilitySnapshot };

export function CrmAvailabilityClient({ snapshot }: Props) {
  const [tab, setTab] = useState<Tab>("live_board");
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  const issueCount  = snapshot.staff.filter((s) => s.scheduleStatus === "no_schedule").length;
  const driverCount = snapshot.staff.filter((s) => s.is_driver).length;

  return (
    <div>
      {/* ── Quick actions + tab bar row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.25rem",
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 2,
            borderBottom: "2px solid var(--cs-border-soft)",
            flex: 1,
            minWidth: 0,
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
                  padding: "7px 13px",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--cs-text)" : "var(--cs-text-muted)",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--cs-sand)" : "2px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: -2,
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
                {badge !== null && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 17, height: 17, borderRadius: 9,
                      background: t.id === "schedule_issues" ? "#c97a18" : "var(--cs-info)",
                      color: "#fff", fontSize: 9, fontWeight: 700, padding: "0 4px",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          {tab !== "schedule_issues" && issueCount > 0 && (
            <button
              type="button"
              onClick={() => setTab("schedule_issues")}
              style={quickActionStyle}
            >
              ⚠ Schedule Issues
            </button>
          )}
          {tab !== "driver_readiness" && driverCount > 0 && (
            <button
              type="button"
              onClick={() => setTab("driver_readiness")}
              style={quickActionStyle}
            >
              🚗 Drivers
            </button>
          )}
          {tab !== "staff_list" && (
            <button
              type="button"
              onClick={() => setTab("staff_list")}
              style={quickActionStyle}
            >
              Staff List
            </button>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
            style={{ ...quickActionStyle, opacity: refreshing ? 0.6 : 1 }}
            aria-label="Refresh availability data"
          >
            {refreshing ? "…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Tab panels ── */}
      <div style={{ marginTop: "0.75rem" }}>
        {tab === "live_board" && (
          <CrmAvailabilityBoard
            staff={snapshot.staff}
            shiftDate={snapshot.date}
          />
        )}

        {tab === "staff_list" && (
          <StaffListView staff={snapshot.staff} shiftDate={snapshot.date} />
        )}

        {tab === "schedule_issues" && (
          <ScheduleIssuesView staff={snapshot.staff} />
        )}

        {tab === "driver_readiness" && (
          <DriverReadinessView staff={snapshot.staff} shiftDate={snapshot.date} />
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: "0.75rem", fontSize: 10, color: "var(--cs-text-muted)" }}>
        As of {formatAsOf(snapshot.asOf)}
        {MVP_CHECKIN_PAUSED
          ? " · Daily check-in is paused for MVP — availability is based on schedules and bookings"
          : " · In-house & dispatch availability requires staff to be scheduled and checked in · Online booking follows saved schedules only"}
      </div>
    </div>
  );
}

// ── Quick action button style ─────────────────────────────────────────────────

const quickActionStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--cs-surface)",
  border: "1px solid var(--cs-border-soft)",
  borderRadius: 6,
  cursor: "pointer",
  color: "var(--cs-text-secondary)",
  whiteSpace: "nowrap",
};

// ── Per-row check-in/out actions (own error state per row) ───────────────────

function StaffRowActions({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow;
  shiftDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shiftEnum = (staff.shifts[0]?.shift_type ?? "single") as "single" | "opening" | "closing";

  const handleCheckin = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const r = await checkInStaffForShiftAction({ staffId: staff.staff_id, shiftDate, shiftType: shiftEnum });
      if (r.ok) router.refresh();
      else setError(r.message);
    });
  }, [staff.staff_id, shiftDate, shiftEnum, router]);

  const handleCheckout = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const r = await checkOutStaffForShiftAction({ staffId: staff.staff_id, shiftDate, shiftType: shiftEnum });
      if (r.ok) router.refresh();
      else setError(r.message);
    });
  }, [staff.staff_id, shiftDate, shiftEnum, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PresenceStatusBadge status={staff.presenceStatus} />
      {!MVP_CHECKIN_PAUSED && staff.presenceStatus === "not_checked_in" && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleCheckin}
          style={{
            padding: "2px 8px", fontSize: 10, fontWeight: 500,
            background: "var(--cs-success)", color: "#fff",
            border: "none", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.5 : 1, width: "fit-content",
          }}
        >
          {isPending ? "…" : "Check in"}
        </button>
      )}
      {!MVP_CHECKIN_PAUSED && staff.presenceStatus === "checked_in" && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleCheckout}
          style={{
            padding: "2px 8px", fontSize: 10, fontWeight: 500,
            background: "transparent", color: "var(--cs-text-muted)",
            border: "1px solid var(--cs-border-soft)", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.5 : 1, width: "fit-content",
          }}
        >
          {isPending ? "…" : "Check out"}
        </button>
      )}
      {error && (
        <span style={{ fontSize: 9, color: "#c0392b", lineHeight: 1.3 }}>{error}</span>
      )}
    </div>
  );
}

// ── Staff List tab ────────────────────────────────────────────────────────────

function StaffListView({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        overflow: "hidden",
      }}
    >
      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 140px 120px 1fr",
          gap: 12,
          padding: "7px 14px",
          background: "var(--cs-surface-raised)",
          borderBottom: "1px solid var(--cs-border-soft)",
          fontSize: 10, fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>Staff</span>
        <span>Status</span>
        <span>Shift</span>
        <span>Presence</span>
        <span>Active Booking</span>
      </div>

      {/* Rows */}
      {staff.map((s) => {
        const primaryShift = s.shifts[0];
        const shiftType    = primaryShift?.shift_type ?? "single";

        return (
          <div
            key={s.staff_id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 140px 120px 1fr",
              alignItems: "center",
              gap: 12,
              padding: "9px 14px",
              borderBottom: "1px solid var(--cs-border-soft)",
              fontSize: 12,
            }}
          >
            {/* Name + role */}
            <div>
              <div style={{ fontWeight: 500, color: "var(--cs-text)" }}>{s.staff_name}</div>
              <div
                style={{
                  fontSize: 10, color: "var(--cs-text-muted)", marginTop: 1,
                  textTransform: "capitalize",
                }}
              >
                {s.staff_type.replace(/_/g, " ")}
              </div>
            </div>

            {/* Availability status */}
            <div><AvailabilityStatusBadge status={s.liveStatus} /></div>

            {/* Shift */}
            <div>
              {s.work_start && s.work_end ? (
                <div>
                  <ShiftTypeBadge shiftType={shiftType} />
                  <div style={{ fontSize: 10, color: "var(--cs-text-subtle)", marginTop: 2 }}>
                    {formatTime12h(s.work_start)} – {formatTime12h(s.work_end)}
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>—</span>
              )}
            </div>

            {/* Presence + check-in/out action (each row has its own error state) */}
            <StaffRowActions staff={s} shiftDate={shiftDate} />

            {/* Active booking */}
            <div style={{ fontSize: 11 }}>
              {s.active_booking ? (
                <div>
                  <span style={{ color: "var(--cs-text)" }}>{s.active_booking.service}</span>
                  <span style={{ color: "var(--cs-text-muted)", marginLeft: 5 }}>
                    {s.active_booking.customer}
                  </span>
                </div>
              ) : s.liveStatus === "available_now" ? (
                <span style={{ color: "var(--cs-success)", fontSize: 10 }}>Free</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Schedule Issues tab ───────────────────────────────────────────────────────

function ScheduleStaffCard({
  staff,
  tagColor,
  tagText,
}: {
  staff: CrmAvailabilityStaffRow;
  tagColor: string;
  tagText: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${tagColor}55`,
        borderRadius: "var(--cs-r-md)",
        padding: "10px 12px",
        background: "var(--cs-surface)",
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 12, color: "var(--cs-text)" }}>{staff.staff_name}</div>
      <div
        style={{
          fontSize: 10, color: "var(--cs-text-muted)", marginTop: 2, textTransform: "capitalize",
        }}
      >
        {staff.staff_type.replace(/_/g, " ")}
      </div>
      <div
        style={{
          marginTop: 7, fontSize: 10, color: tagColor,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span>⚠</span> {tagText}
      </div>
    </div>
  );
}

function ScheduleIssuesView({ staff }: { staff: CrmAvailabilityStaffRow[] }) {
  const allIssues       = staff.filter((s) => s.scheduleStatus === "no_schedule");
  const serviceIssues   = allIssues.filter((s) => s.is_service_provider);
  const opsIssues       = allIssues.filter((s) => !s.is_service_provider);

  if (allIssues.length === 0) {
    return (
      <ReadinessIssueList
        issues={[]}
        emptyTitle="No schedule issues today"
        emptyDescription="All staff have a weekly schedule pattern set."
      />
    );
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "0.625rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Service staff — affects online booking */}
      {serviceIssues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <ReadinessIssueCard issue={buildServiceStaffNoScheduleIssue(serviceIssues.length)} compact />
          <div style={gridStyle}>
            {serviceIssues.map((s) => (
              <ScheduleStaffCard
                key={s.staff_id}
                staff={s}
                tagColor="#b35b0a"
                tagText="Not in online booking engine"
              />
            ))}
          </div>
        </div>
      )}

      {/* Ops staff (drivers, CSR, utility) — affects live availability only */}
      {opsIssues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <ReadinessIssueCard issue={buildOpsStaffNoScheduleIssue(opsIssues.length)} compact />
          <div style={gridStyle}>
            {opsIssues.map((s) => (
              <ScheduleStaffCard
                key={s.staff_id}
                staff={s}
                tagColor="#6b7280"
                tagText="No schedule for live board"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Driver card with own error state ─────────────────────────────────────────

function DriverCard({
  driver,
  shiftDate,
}: {
  driver: CrmAvailabilityStaffRow;
  shiftDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isReady      = driver.liveStatus === "available_now";
  const isCheckedIn  = driver.presenceStatus === "checked_in";
  const notCheckedIn = driver.presenceStatus === "not_checked_in";
  const shiftEnum    = (driver.shifts[0]?.shift_type ?? "single") as "single" | "opening" | "closing";
  const border       = isReady ? "rgba(39,174,96,0.4)" : (!MVP_CHECKIN_PAUSED && notCheckedIn) ? "rgba(230,126,34,0.4)" : "var(--cs-border-soft)";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "var(--cs-r-md)",
        padding: "10px 12px",
        background: "var(--cs-surface)",
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 12, color: "var(--cs-text)" }}>{driver.staff_name}</div>
      <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 2 }}>Driver</div>
      {driver.work_start && driver.work_end && (
        <div style={{ fontSize: 10, color: "var(--cs-text-subtle)", marginTop: 3 }}>
          {formatTime12h(driver.work_start)} – {formatTime12h(driver.work_end)}
        </div>
      )}
      <div style={{ marginTop: 7 }}>
        <AvailabilityStatusBadge status={driver.liveStatus} />
      </div>
      {!MVP_CHECKIN_PAUSED && notCheckedIn && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setError(null);
              const r = await checkInStaffForShiftAction({
                staffId: driver.staff_id, shiftDate, shiftType: shiftEnum,
              });
              if (r.ok) router.refresh();
              else setError(r.message);
            });
          }}
          style={{
            marginTop: 7,
            padding: "3px 10px", fontSize: 10, fontWeight: 500,
            background: "var(--cs-success)", color: "#fff",
            border: "none", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? "…" : "Check in"}
        </button>
      )}
      {!MVP_CHECKIN_PAUSED && isCheckedIn && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setError(null);
              const r = await checkOutStaffForShiftAction({
                staffId: driver.staff_id, shiftDate, shiftType: shiftEnum,
              });
              if (r.ok) router.refresh();
              else setError(r.message);
            });
          }}
          style={{
            marginTop: 7,
            padding: "3px 10px", fontSize: 10, fontWeight: 500,
            background: "transparent", color: "var(--cs-text-muted)",
            border: "1px solid var(--cs-border-soft)", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? "…" : "Check out"}
        </button>
      )}
      {error && (
        <div style={{ marginTop: 4, fontSize: 9, color: "#c0392b", lineHeight: 1.3 }}>{error}</div>
      )}
    </div>
  );
}

// ── Driver Readiness tab ──────────────────────────────────────────────────────

function DriverReadinessView({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
}) {
  const drivers = staff.filter((s) => s.is_driver);
  if (drivers.length === 0) {
    return (
      <div
        style={{
          padding: "28px 16px", textAlign: "center",
          color: "var(--cs-text-muted)", fontSize: 12,
        }}
      >
        No drivers found for this branch.
      </div>
    );
  }

  const ready = drivers.filter((s) => s.liveStatus === "available_now");

  return (
    <div>
      <div style={{ marginBottom: "0.75rem", fontSize: 11, color: "var(--cs-text-muted)" }}>
        {drivers.length} driver{drivers.length !== 1 ? "s" : ""} on schedule
        {" · "}
        {ready.length} ready for dispatch.
        {" "}
        {MVP_CHECKIN_PAUSED ? (
          <span style={{ color: "var(--cs-text-muted)" }}>
            Daily check-in is paused for MVP. Availability is based on schedules and bookings.
          </span>
        ) : (
          <span style={{ color: ready.length === 0 ? "#b35b0a" : "inherit" }}>
            {ready.length === 0
              ? "Home-service dispatch cannot start until at least one driver is checked in."
              : "Check-in required for dispatch readiness."}
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "0.625rem",
        }}
      >
        {drivers.map((s) => (
          <DriverCard key={s.staff_id} driver={s} shiftDate={shiftDate} />
        ))}
      </div>
    </div>
  );
}
