"use client";

import type { CrmAvailabilityStaffRow } from "@/lib/queries/crm-availability";

const SHIFT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  opening: { label: "Opening shift", bg: "rgba(74,124,89,0.12)",  color: "#4A7C59" },
  closing: { label: "Closing shift",  bg: "rgba(59,130,246,0.12)", color: "#2563EB" },
  single:  { label: "Regular shift",  bg: "rgba(107,114,128,0.1)", color: "var(--cs-text-muted)" },
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
        width: 34, height: 34, borderRadius: "50%",
        background: "var(--cs-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, color: "var(--cs-text-muted)",
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
        display: "inline-block", padding: "1px 7px",
        borderRadius: 10, fontSize: 10, fontWeight: 500,
        background: cfg.bg, color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

function StaffCard({ staff }: { staff: CrmAvailabilityStaffRow }) {
  const primaryShift = staff.shifts[0];
  const shiftType = primaryShift?.shift_type ?? "single";
  const hasMultiShift = staff.shifts.length > 1;

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header: avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Initials name={staff.staff_name} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13, fontWeight: 500, color: "var(--cs-text)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {staff.staff_name}
          </div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", textTransform: "capitalize" }}>
            {(staff.staff_type || staff.system_role).replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Shift badge */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {hasMultiShift ? (
          staff.shifts.map((s) => <ShiftBadge key={s.shift_type} shiftType={s.shift_type} />)
        ) : (
          <ShiftBadge shiftType={shiftType} />
        )}
      </div>

      {/* Shift window */}
      {staff.work_start && staff.work_end && (
        <div style={{ fontSize: 11, color: "var(--cs-text-subtle)" }}>
          {formatTime(staff.work_start)} – {formatTime(staff.work_end)}
        </div>
      )}

      {/* Status indicator */}
      <div style={{ fontSize: 11 }}>
        {staff.liveStatus === "busy_now" && staff.active_booking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cs-info)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--cs-text-muted)" }}>
              {staff.active_booking.service}
            </span>
          </div>
        ) : staff.liveStatus === "available_now" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cs-success)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--cs-text-muted)" }}>No booking</span>
          </div>
        ) : staff.liveStatus === "off_today" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cs-text-muted)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--cs-text-muted)" }}>Day off today</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cs-warning)", display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "var(--cs-warning)" }}>No weekly schedule set</span>
          </div>
        )}
      </div>
    </div>
  );
}

type ColumnDef = {
  key: string;
  title: string;
  subtitle: string;
  filter: (s: CrmAvailabilityStaffRow) => boolean;
  countColor: string;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "available",
    title: "Available Now",
    subtitle: "Scheduled and free",
    filter: (s) => s.liveStatus === "available_now",
    countColor: "var(--cs-success)",
  },
  {
    key: "busy",
    title: "Busy / Assigned",
    subtitle: "In session or with booking",
    filter: (s) => s.liveStatus === "busy_now",
    countColor: "var(--cs-info)",
  },
  {
    key: "off",
    title: "Off Today",
    subtitle: "Not scheduled",
    filter: (s) => s.liveStatus === "off_today",
    countColor: "var(--cs-text-muted)",
  },
  {
    key: "attention",
    title: "Needs Attention",
    subtitle: "Requires action",
    filter: (s) => s.needsAttention,
    countColor: "var(--cs-warning)",
  },
];

type Props = {
  staff: CrmAvailabilityStaffRow[];
  maxPerColumn?: number;
};

export function CrmAvailabilityBoard({ staff, maxPerColumn = 4 }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
            <div
              style={{
                display: "flex", alignItems: "baseline", gap: 6,
                marginBottom: "0.625rem",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>
                {col.title}
              </span>
              <span
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: col.countColor,
                  background: `${col.countColor}15`,
                  padding: "0 6px", borderRadius: 8,
                }}
              >
                {colStaff.length}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>
              {col.subtitle}
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((s) => (
                <StaffCard key={s.staff_id} staff={s} />
              ))}
              {shown.length === 0 && (
                <div
                  style={{
                    padding: "20px 14px", textAlign: "center",
                    fontSize: 12, color: "var(--cs-text-muted)",
                    border: "1px dashed var(--cs-border-soft)",
                    borderRadius: "var(--cs-r-md)",
                  }}
                >
                  None
                </div>
              )}
            </div>

            {remaining > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--cs-text-muted)", textAlign: "center" }}>
                + View all {colStaff.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
