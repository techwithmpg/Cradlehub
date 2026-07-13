"use client";

import { useState, useMemo } from "react";
import { ClipboardList, Search, Clock, MapPin, User } from "lucide-react";
import {
  readRelation,
  formatTime12,
  getUrgencyScore,
  bookingNeedsResourceAssignment,
  type TodayBooking,
} from "@/components/features/manager-today/manager-today-utils";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import type { StatusFilter } from "./types";

type Props = {
  bookings: TodayBooking[];
  userRole: string;
};

type Segment = "bookings" | "issues";

export function ManagerBookingsScreen({ bookings, userRole }: Props) {
  const [segment, setSegment] = useState<Segment>("bookings");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const activeBookings = bookings.filter((b) => b.status !== "cancelled" && b.status !== "no_show");

  const issues = useMemo(() => {
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return activeBookings
      .filter((b) => getUrgencyScore(b, nowMins) > 0)
      .sort((a, b) => getUrgencyScore(b, nowMins) - getUrgencyScore(a, nowMins));
  }, [activeBookings]);

  const filtered = useMemo(() => {
    let rows = segment === "issues" ? issues : activeBookings;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((b) => {
        const customer = readRelation(b.customers);
        const service = readRelation(b.services);
        const staffMember = readRelation(b.staff);
        const staffName = staffMember ? getStaffAdminName(staffMember) : "";
        return (
          (customer?.full_name.toLowerCase().includes(q) ?? false) ||
          (service?.name.toLowerCase().includes(q) ?? false) ||
          staffName.toLowerCase().includes(q)
        );
      });
    }
    if (filter !== "all") {
      rows = rows.filter((b) => {
        if (filter === "pending") return b.status === "pending";
        if (filter === "confirmed") return b.status === "confirmed";
        if (filter === "changes") return b.status === "in_progress";
        if (filter === "problem") return getUrgencyScore(b, new Date().getHours() * 60 + new Date().getMinutes()) > 0;
        return true;
      });
    }
    return rows;
  }, [segment, issues, activeBookings, search, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
          Bookings
        </h1>
        <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "4px 0 0" }}>
          Manage appointments and issues
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "10px 12px",
        }}
      >
        <Search size={16} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search bookings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 14,
            color: "var(--cs-text)",
            width: "100%",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Segment Tabs */}
      <div
        style={{
          display: "flex",
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: 4,
          gap: 4,
        }}
      >
        {[
          { key: "bookings" as Segment, label: "Bookings" },
          { key: "issues" as Segment, label: `Issues ${issues.length > 0 ? `(${issues.length})` : ""}` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSegment(t.key)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: "var(--cs-r-md)",
              border: "none",
              background: segment === t.key ? "var(--cs-sand-tint)" : "transparent",
              color: segment === t.key ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter Pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {([
          { key: "all" as StatusFilter, label: "All" },
          { key: "pending" as StatusFilter, label: "Pending" },
          { key: "confirmed" as StatusFilter, label: "Confirmed" },
          { key: "changes" as StatusFilter, label: "In Progress" },
          { key: "problem" as StatusFilter, label: "Problem" },
        ]).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFilter(p.key)}
            style={{
              padding: "5px 12px",
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

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState message={segment === "issues" ? "Everything looks smooth" : "No bookings found"} />
        ) : (
          filtered.map((b) => <BookingCard key={b.id} booking={b} userRole={userRole} />)
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking }: { booking: TodayBooking; userRole: string }) {
  const customer = readRelation(booking.customers);
  const service = readRelation(booking.services);
  const staffMember = readRelation(booking.staff);
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const issueLabels: string[] = [];
  if (booking.status === "pending") issueLabels.push("Pending");
  if (bookingNeedsResourceAssignment(booking)) issueLabels.push("No room");
  if (!staffMember) issueLabels.push("No therapist");
  if (getUrgencyScore(booking, nowMins) === 70) issueLabels.push("Starting soon");

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {customer?.full_name ?? "Guest"}
          </div>
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
            {service?.name ?? "Service"}
          </div>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--cs-text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} /> {formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}
        </span>
        {staffMember && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <User size={12} /> {getStaffAdminName(staffMember)}
          </span>
        )}
        {booking.branch_resources?.name ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} /> {booking.branch_resources.name}
          </span>
        ) : bookingNeedsResourceAssignment(booking) ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--cs-error)" }}>
            <MapPin size={12} /> No room
          </span>
        ) : null}
      </div>

      {issueLabels.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {issueLabels.map((issue) => (
            <span
              key={issue}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--cs-r-pill)",
                background: issue === "Pending" ? "var(--cs-warning-bg)" : "var(--cs-error-bg)",
                color: issue === "Pending" ? "var(--cs-warning-text)" : "var(--cs-error-text)",
              }}
            >
              {issue}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: "var(--cs-r-md)",
            border: "none",
            background: "var(--cs-sand-tint)",
            color: "var(--cs-sand-dark)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          Review
        </button>
        <button
          type="button"
          disabled
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: "var(--cs-r-md)",
            border: "1px solid var(--cs-border-soft)",
            background: "var(--cs-surface)",
            color: "var(--cs-text-secondary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          Resolve
        </button>
      </div>
    </div>
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
      <ClipboardList size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
      <div>{message}</div>
    </div>
  );
}
