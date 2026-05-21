"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CrmAvailabilityStaffRow } from "@/lib/queries/crm-availability";
import { checkInStaffForShiftAction, checkOutStaffForShiftAction } from "@/lib/actions/staff-checkins";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SHIFT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  opening: { label: "Opening", bg: "rgba(74,124,89,0.12)",  color: "#4A7C59" },
  closing: { label: "Closing", bg: "rgba(59,130,246,0.12)", color: "#2563EB" },
  single:  { label: "Regular", bg: "rgba(107,114,128,0.1)", color: "var(--cs-text-muted)" },
};

function formatTime(t: string): string {
  const parts = t.slice(0, 5).split(":");
  if (parts.length < 2) return t;
  const [h, m] = parts;
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "var(--cs-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function ShiftBadge({ shiftType }: { shiftType: string }) {
  const cfg = SHIFT_BADGE[shiftType] ?? SHIFT_BADGE.single!;
  return (
    <span
      style={{
        display: "inline-block", padding: "1px 6px",
        borderRadius: 10, fontSize: 10, fontWeight: 500,
        background: cfg.bg, color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

function PresenceBadge({ presenceStatus }: { presenceStatus: CrmAvailabilityStaffRow["presenceStatus"] }) {
  const cfg: Record<string, { label: string; color: string }> = {
    checked_in:     { label: "Checked in",     color: "var(--cs-success)" },
    not_checked_in: { label: "Not checked in",  color: "var(--cs-warning)" },
    checked_out:    { label: "Checked out",     color: "var(--cs-text-muted)" },
    off_today:      { label: "Off today",       color: "var(--cs-text-muted)" },
    no_schedule:    { label: "No schedule",     color: "var(--cs-warning)" },
  };
  const c = cfg[presenceStatus] ?? { label: presenceStatus, color: "var(--cs-text-muted)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: c.color, display: "inline-block", flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10, color: c.color, fontWeight: 500 }}>{c.label}</span>
    </div>
  );
}

// ── Check-in action button ────────────────────────────────────────────────────

function CheckinButton({
  staff,
  shiftDate,
  branchId,
}: {
  staff: CrmAvailabilityStaffRow;
  shiftDate: string;
  branchId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const primaryShiftType = (staff.shifts[0]?.shift_type ?? "single") as "single" | "opening" | "closing";

  if (staff.presenceStatus === "checked_in") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await checkOutStaffForShiftAction({
              staffId: staff.staff_id,
              shiftDate,
              shiftType: primaryShiftType,
            });
            router.refresh();
          });
        }}
        style={{
          marginTop: 6,
          padding: "3px 10px", fontSize: 11, fontWeight: 500,
          background: "transparent",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: 6, cursor: isPending ? "wait" : "pointer",
          color: "var(--cs-text-muted)",
          opacity: isPending ? 0.5 : 1,
        }}
      >
        {isPending ? "…" : "Check out"}
      </button>
    );
  }

  if (staff.presenceStatus === "not_checked_in") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await checkInStaffForShiftAction({
              staffId: staff.staff_id,
              branchId,
              shiftDate,
              shiftType: primaryShiftType,
            });
            router.refresh();
          });
        }}
        style={{
          marginTop: 6,
          padding: "3px 10px", fontSize: 11, fontWeight: 500,
          background: "var(--cs-success)",
          border: "none",
          borderRadius: 6, cursor: isPending ? "wait" : "pointer",
          color: "#fff",
          opacity: isPending ? 0.5 : 1,
        }}
      >
        {isPending ? "…" : "Check in"}
      </button>
    );
  }

  return null;
}

// ── Staff card ────────────────────────────────────────────────────────────────

function StaffCard({
  staff,
  shiftDate,
  branchId,
  showCheckinButton,
}: {
  staff: CrmAvailabilityStaffRow;
  shiftDate: string;
  branchId: string;
  showCheckinButton: boolean;
}) {
  const primaryShift = staff.shifts[0];
  const shiftType = primaryShift?.shift_type ?? "single";
  const hasMultiShift = staff.shifts.length > 1;

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Initials name={staff.staff_name} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12, fontWeight: 500, color: "var(--cs-text)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {staff.staff_name}
          </div>
          <div style={{ fontSize: 10, color: "var(--cs-text-muted)", textTransform: "capitalize" }}>
            {(staff.staff_type || staff.system_role).replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Shift badges */}
      {staff.work_start && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {hasMultiShift
            ? staff.shifts.map((s) => <ShiftBadge key={s.shift_type} shiftType={s.shift_type} />)
            : <ShiftBadge shiftType={shiftType} />
          }
        </div>
      )}

      {/* Shift window */}
      {staff.work_start && staff.work_end && (
        <div style={{ fontSize: 10, color: "var(--cs-text-subtle)" }}>
          {formatTime(staff.work_start)} – {formatTime(staff.work_end)}
        </div>
      )}

      {/* Presence badge */}
      <PresenceBadge presenceStatus={staff.presenceStatus} />

      {/* Active booking */}
      {staff.liveStatus === "busy_now" && staff.active_booking && (
        <div style={{ fontSize: 10, color: "var(--cs-text-muted)" }}>
          {staff.active_booking.service}
        </div>
      )}

      {/* No-schedule warning */}
      {staff.liveStatus === "no_schedule" && (
        <div style={{ fontSize: 10, color: "var(--cs-warning)" }}>No weekly schedule set</div>
      )}

      {/* Check-in / check-out action */}
      {showCheckinButton && (
        <CheckinButton staff={staff} shiftDate={shiftDate} branchId={branchId} />
      )}
    </div>
  );
}

// ── Board columns ─────────────────────────────────────────────────────────────

type ColumnDef = {
  key: string;
  title: string;
  subtitle: string;
  filter: (s: CrmAvailabilityStaffRow) => boolean;
  countColor: string;
  showCheckinButton: boolean;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "available",
    title: "Available Now",
    subtitle: "Checked in and free",
    filter: (s) => s.liveStatus === "available_now",
    countColor: "var(--cs-success)",
    showCheckinButton: false,
  },
  {
    key: "busy",
    title: "Busy / Assigned",
    subtitle: "In session or assigned",
    filter: (s) => s.liveStatus === "busy_now",
    countColor: "var(--cs-info)",
    showCheckinButton: false,
  },
  {
    key: "not_checked_in",
    title: "Not Checked In",
    subtitle: "Scheduled but absent",
    filter: (s) => s.liveStatus === "not_checked_in",
    countColor: "var(--cs-warning)",
    showCheckinButton: true,
  },
  {
    key: "off_checked_out",
    title: "Off / Checked Out",
    subtitle: "Not available",
    filter: (s) => s.liveStatus === "off_today" || s.liveStatus === "checked_out",
    countColor: "var(--cs-text-muted)",
    showCheckinButton: false,
  },
  {
    key: "attention",
    title: "Needs Attention",
    subtitle: "Setup required",
    filter: (s) => s.needsAttention,
    countColor: "var(--cs-warning)",
    showCheckinButton: false,
  },
];

// ── Board ─────────────────────────────────────────────────────────────────────

type Props = {
  staff: CrmAvailabilityStaffRow[];
  maxPerColumn?: number;
  shiftDate: string;
  branchId: string;
};

export function CrmAvailabilityBoard({ staff, maxPerColumn = 5, shiftDate, branchId }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "1rem",
        alignItems: "start",
      }}
    >
      {COLUMNS.map((col) => {
        const colStaff = staff.filter(col.filter);
        const shown = colStaff.slice(0, maxPerColumn);
        const remaining = colStaff.length - shown.length;

        return (
          <div key={col.key}>
            {/* Column header */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: "0.5rem" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)" }}>{col.title}</span>
              <span
                style={{
                  fontSize: 11, fontWeight: 600,
                  color: col.countColor,
                  background: `${col.countColor}18`,
                  padding: "0 5px", borderRadius: 8,
                }}
              >
                {colStaff.length}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginBottom: "0.625rem" }}>
              {col.subtitle}
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {shown.map((s) => (
                <StaffCard
                  key={s.staff_id}
                  staff={s}
                  shiftDate={shiftDate}
                  branchId={branchId}
                  showCheckinButton={col.showCheckinButton}
                />
              ))}
              {shown.length === 0 && (
                <div
                  style={{
                    padding: "18px 12px", textAlign: "center",
                    fontSize: 11, color: "var(--cs-text-muted)",
                    border: "1px dashed var(--cs-border-soft)",
                    borderRadius: "var(--cs-r-md)",
                  }}
                >
                  None
                </div>
              )}
            </div>

            {remaining > 0 && (
              <div style={{ marginTop: 5, fontSize: 10, color: "var(--cs-text-muted)", textAlign: "center" }}>
                +{remaining} more
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
