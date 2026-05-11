"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
// STAFF_TYPE_LABELS can be used when staff_type is available in schedule data

type Props = {
  scheduleRows: DailyScheduleStaffRow[];
};

type FilterPill = "all" | "therapists" | "nail_techs" | "available";

export function ManagerScheduleScreen({ scheduleRows }: Props) {
  const [filter, setFilter] = useState<FilterPill>("all");

  const filtered = useMemo(() => {
    let rows = scheduleRows;
    if (filter === "therapists") {
      rows = rows.filter((r) => r.staff_tier);
    }
    if (filter === "nail_techs") {
      // Nail techs may not have tier; approximate by name or show all for now
      rows = rows; // No reliable nail_tech filter in schedule data without staff_type
    }
    if (filter === "available") {
      rows = rows.filter((r) => r.work_start && r.bookings.length === 0);
    }
    return rows;
  }, [scheduleRows, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Schedule
        </h1>
        <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "4px 0 0" }}>
          Who is working today
        </p>
      </div>

      {/* Filter Pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { key: "all" as FilterPill, label: "All" },
          { key: "therapists" as FilterPill, label: "Therapists" },
          { key: "available" as FilterPill, label: "Available" },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFilter(p.key)}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--cs-r-pill)",
              border: "1px solid",
              borderColor: filter === p.key ? "var(--cs-sand)" : "var(--cs-border-soft)",
              background: filter === p.key ? "var(--cs-sand-tint)" : "var(--cs-surface)",
              color: filter === p.key ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Staff List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState message="No staff match this filter" />
        ) : (
          filtered.map((row) => <StaffScheduleCard key={row.staff_id} row={row} />)
        )}
      </div>
    </div>
  );
}

function StaffScheduleCard({ row }: { row: DailyScheduleStaffRow }) {
  const status = row.work_start
    ? row.bookings.length > 0
      ? "in_session"
      : "available"
    : "off_duty";

  const currentBooking = row.bookings[0];

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "12px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--cs-sand-dark)",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {getInitials(row.staff_name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {row.staff_name}
          </div>
          <StatusBadge status={status} />
        </div>

        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
          {row.staff_tier ? `${capitalize(row.staff_tier)} Therapist` : "Staff"}
        </div>

        {currentBooking && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "var(--cs-surface-warm)",
              borderRadius: "var(--cs-r-md)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--cs-text)" }}>
              {currentBooking.service} — {currentBooking.customer}
            </div>
            <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={11} /> {currentBooking.start_time.slice(0, 5)} – {currentBooking.end_time.slice(0, 5)}
              </span>
              {currentBooking.resource_name && (
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {currentBooking.resource_name}
                </span>
              )}
            </div>
          </div>
        )}

        {!currentBooking && row.work_start && (
          <div style={{ fontSize: 12, color: "var(--cs-success)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={12} /> Available until {row.work_end?.slice(0, 5) ?? "close"}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "in_session" | "available" | "off_duty" | "booked" | "break" }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    in_session: { label: "In Session", bg: "var(--cs-owner-bg)", color: "var(--cs-owner-text)" },
    booked: { label: "Booked", bg: "var(--cs-info-bg)", color: "var(--cs-info-text)" },
    available: { label: "Available", bg: "var(--cs-success-bg)", color: "var(--cs-success-text)" },
    break: { label: "Break", bg: "var(--cs-warning-bg)", color: "var(--cs-warning-text)" },
    off_duty: { label: "Off Duty", bg: "var(--cs-neutral-bg)", color: "var(--cs-neutral-text)" },
  };
  const s = map[status] ?? map["available"]!;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "var(--cs-r-pill)",
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2rem 1rem",
        color: "var(--cs-text-muted)",
        fontSize: 14,
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      <CalendarDays size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
      <div>{message}</div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
