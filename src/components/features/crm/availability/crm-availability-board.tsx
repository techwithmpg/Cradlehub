"use client";

import type { CrmAvailabilityStaffRow, LiveStatus } from "@/lib/queries/crm-availability";

const STATUS_CONFIG: Record<LiveStatus, { label: string; color: string; dot: string }> = {
  available_now: { label: "Available",  color: "var(--cs-success)",     dot: "var(--cs-success)" },
  busy_now:      { label: "Busy",        color: "var(--cs-info)",        dot: "var(--cs-info)" },
  off_today:     { label: "Off",         color: "var(--cs-text-muted)",  dot: "var(--cs-text-muted)" },
  no_schedule:   { label: "No Schedule", color: "var(--cs-warning)",     dot: "var(--cs-warning)" },
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

type RowProps = { staff: CrmAvailabilityStaffRow };

function StaffRow({ staff }: RowProps) {
  const cfg = STATUS_CONFIG[staff.liveStatus];

  return (
    <div
      style={{
        display:       "grid",
        gridTemplateColumns: "1fr 90px 140px 1fr",
        alignItems:    "center",
        gap:           12,
        padding:       "10px 14px",
        borderBottom:  "1px solid var(--cs-border-soft)",
        fontSize:      13,
      }}
    >
      {/* Name + type */}
      <div>
        <div style={{ fontWeight: 500, color: "var(--cs-text)" }}>{staff.staff_name}</div>
        <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 1, textTransform: "capitalize" }}>
          {staff.staff_type.replace("_", " ")}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
        <span style={{ color: cfg.color, fontWeight: 500, fontSize: 12 }}>{cfg.label}</span>
      </div>

      {/* Shift window */}
      <div style={{ color: "var(--cs-text-subtle)", fontSize: 12 }}>
        {staff.work_start && staff.work_end
          ? `${formatTime(staff.work_start)} – ${formatTime(staff.work_end)}`
          : <span style={{ color: "var(--cs-text-muted)" }}>—</span>}
      </div>

      {/* Active booking */}
      <div style={{ fontSize: 12 }}>
        {staff.active_booking ? (
          <div>
            <span style={{ color: "var(--cs-text)" }}>{staff.active_booking.service}</span>
            <span style={{ color: "var(--cs-text-muted)", marginLeft: 6 }}>
              {staff.active_booking.customer}
            </span>
          </div>
        ) : staff.liveStatus === "available_now" ? (
          <span style={{ color: "var(--cs-success)", fontSize: 11 }}>Free</span>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  staff: CrmAvailabilityStaffRow[];
  filter?: "all" | "service" | "driver" | "issues";
};

export function CrmAvailabilityBoard({ staff, filter = "all" }: Props) {
  let rows = staff;

  if (filter === "service") {
    rows = staff.filter((s) => s.is_service_provider);
  } else if (filter === "driver") {
    rows = staff.filter((s) => s.is_driver);
  } else if (filter === "issues") {
    rows = staff.filter((s) => s.scheduleStatus === "no_schedule");
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--cs-text-muted)", fontSize: 13 }}>
        No staff to display for this filter.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display:       "grid",
          gridTemplateColumns: "1fr 90px 140px 1fr",
          gap:           12,
          padding:       "8px 14px",
          background:    "var(--cs-surface-raised)",
          borderBottom:  "1px solid var(--cs-border-soft)",
          fontSize:      11,
          fontWeight:    600,
          color:         "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>Staff</span>
        <span>Status</span>
        <span>Shift</span>
        <span>Active Booking</span>
      </div>

      {rows.map((s) => (
        <StaffRow key={s.staff_id} staff={s} />
      ))}
    </div>
  );
}
