"use client";

import { useState, useTransition } from "react";
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
import { buildNoScheduleStaffIssue } from "./availability-readiness-utils";

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

      {/* Footer note */}
      <div style={{ marginTop: "1rem", fontSize: 11, color: "var(--cs-text-muted)" }}>
        As of {formatAsOf(snapshot.asOf)}.
        Availability requires staff to be scheduled and checked in.
      </div>
    </div>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────────────────

function StaffListView({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", overflow: "hidden" }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 100px 130px 120px 1fr",
          gap: 12, padding: "8px 14px",
          background: "var(--cs-surface-raised)", borderBottom: "1px solid var(--cs-border-soft)",
          fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}
      >
        <span>Staff</span>
        <span>Status</span>
        <span>Shift</span>
        <span>Presence</span>
        <span>Active Booking</span>
      </div>
      {staff.map((s) => {
        const primaryShift = s.shifts[0];
        const shiftType = primaryShift?.shift_type ?? "single";
        const primaryShiftTypeEnum = (primaryShift?.shift_type ?? "single") as "single" | "opening" | "closing";

        return (
          <div
            key={s.staff_id}
            style={{
              display: "grid", gridTemplateColumns: "1fr 100px 130px 120px 1fr",
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
            <div>
              <AvailabilityStatusBadge status={s.liveStatus} />
            </div>
            <div>
              {s.work_start && s.work_end ? (
                <div>
                  <ShiftTypeBadge shiftType={shiftType} />
                  <div style={{ fontSize: 11, color: "var(--cs-text-subtle)", marginTop: 2 }}>
                    {formatTime12h(s.work_start)} – {formatTime12h(s.work_end)}
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>—</span>
              )}
            </div>
            {/* Presence + action */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <PresenceStatusBadge status={s.presenceStatus} />
              {s.presenceStatus === "not_checked_in" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await checkInStaffForShiftAction({
                        staffId: s.staff_id,
                        shiftDate,
                        shiftType: primaryShiftTypeEnum,
                      });
                      if (result.ok) router.refresh();
                    });
                  }}
                  style={{
                    padding: "2px 8px", fontSize: 10, fontWeight: 500,
                    background: "var(--cs-success)", color: "#fff",
                    border: "none", borderRadius: 5, cursor: "pointer",
                    opacity: pending ? 0.5 : 1, width: "fit-content",
                  }}
                >
                  Check in
                </button>
              )}
              {s.presenceStatus === "checked_in" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await checkOutStaffForShiftAction({
                        staffId: s.staff_id,
                        shiftDate,
                        shiftType: primaryShiftTypeEnum,
                      });
                      if (result.ok) router.refresh();
                    });
                  }}
                  style={{
                    padding: "2px 8px", fontSize: 10, fontWeight: 500,
                    background: "transparent", color: "var(--cs-text-muted)",
                    border: "1px solid var(--cs-border-soft)", borderRadius: 5, cursor: "pointer",
                    opacity: pending ? 0.5 : 1, width: "fit-content",
                  }}
                >
                  Check out
                </button>
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
      <ReadinessIssueList
        issues={[]}
        emptyTitle="No schedule issues today"
        emptyDescription="All staff have a weekly schedule pattern set."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Issue banner */}
      <ReadinessIssueCard issue={buildNoScheduleStaffIssue(issues.length)} compact />

      {/* Per-staff detail grid */}
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

function DriverReadinessView({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const drivers = staff.filter((s) => s.is_driver);
  if (drivers.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--cs-text-muted)", fontSize: 13 }}>
        No drivers found for this branch.
      </div>
    );
  }

  const checkedIn = drivers.filter((s) => s.presenceStatus === "checked_in");
  const ready     = drivers.filter((s) => s.liveStatus === "available_now");

  return (
    <div>
      <div style={{ marginBottom: "0.75rem", fontSize: 12, color: "var(--cs-text-muted)" }}>
        {checkedIn.length} of {drivers.length} driver{drivers.length !== 1 ? "s" : ""} checked in.{" "}
        {ready.length} ready to dispatch.
        Check-in required for dispatch readiness.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {drivers.map((s) => {
          const isReady      = s.liveStatus === "available_now";
          const isCheckedIn  = s.presenceStatus === "checked_in";
          const notCheckedIn = s.presenceStatus === "not_checked_in";
          const primaryShiftTypeEnum = (s.shifts[0]?.shift_type ?? "single") as "single" | "opening" | "closing";

          const borderColor = isReady ? "var(--cs-success)" : notCheckedIn ? "var(--cs-warning)" : "var(--cs-border-soft)";

          return (
            <div
              key={s.staff_id}
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--cs-r-md)", padding: "12px 14px",
                background: "var(--cs-surface)",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--cs-text)" }}>{s.staff_name}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>Driver</div>
              {s.work_start && s.work_end && (
                <div style={{ fontSize: 11, color: "var(--cs-text-subtle)", marginTop: 4 }}>
                  {formatTime12h(s.work_start)} – {formatTime12h(s.work_end)}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <AvailabilityStatusBadge status={s.liveStatus} />
              </div>
              {/* Check-in action for not-checked-in drivers */}
              {notCheckedIn && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await checkInStaffForShiftAction({
                        staffId: s.staff_id,
                        shiftDate,
                        shiftType: primaryShiftTypeEnum,
                      });
                      if (result.ok) router.refresh();
                    });
                  }}
                  style={{
                    marginTop: 8,
                    padding: "3px 10px", fontSize: 11, fontWeight: 500,
                    background: "var(--cs-success)", color: "#fff",
                    border: "none", borderRadius: 6, cursor: "pointer",
                    opacity: pending ? 0.5 : 1,
                  }}
                >
                  {pending ? "…" : "Check in"}
                </button>
              )}
              {/* Check-out for already checked-in drivers */}
              {isCheckedIn && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await checkOutStaffForShiftAction({
                        staffId: s.staff_id,
                        shiftDate,
                        shiftType: primaryShiftTypeEnum,
                      });
                      if (result.ok) router.refresh();
                    });
                  }}
                  style={{
                    marginTop: 8,
                    padding: "3px 10px", fontSize: 11, fontWeight: 500,
                    background: "transparent", color: "var(--cs-text-muted)",
                    border: "1px solid var(--cs-border-soft)", borderRadius: 6, cursor: "pointer",
                    opacity: pending ? 0.5 : 1,
                  }}
                >
                  {pending ? "…" : "Check out"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
