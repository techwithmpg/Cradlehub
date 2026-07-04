"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Building2, Search, ListFilter, ClipboardList } from "lucide-react";
import { addDaysToYmd, formatBranchYmd, getBranchBusinessDate } from "@/lib/engine/slot-time";

export type ScheduleToolbarProps = {
  workspaceContext: "owner" | "manager" | "crm";
  branchId: string;
  branchName: string;
  date: string;
  branches?: { id: string; name: string }[];
  staffSearch: string;
  statusFilter: string;
  typeFilter: string;
  onStaffSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onDateChange: (date: string) => void;
  viewBookingsHref: string;
};

function shiftDate(dateStr: string, days: number): string {
  return addDaysToYmd(dateStr, days);
}

export function ScheduleToolbar({
  workspaceContext,
  branchId,
  branchName,
  date,
  branches,
  staffSearch,
  statusFilter,
  typeFilter,
  onStaffSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onDateChange,
  viewBookingsHref,
}: ScheduleToolbarProps) {
  const router = useRouter();
  const today = getBranchBusinessDate();
  const isToday = date === today;
  const formattedDate = formatBranchYmd(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isOwner = workspaceContext === "owner";

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "0.625rem 0.875rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      {/* Date navigator */}
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(date, -1))}
        className="cs-btn cs-btn-ghost cs-btn-sm"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text)",
        }}
      >
        <CalendarDays className="h-4 w-4" style={{ color: "var(--cs-sand)" }} />
        {formattedDate}
        {isToday && (
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "2px 8px",
              borderRadius: 100,
              background: "var(--cs-success-bg)",
              color: "var(--cs-success)",
            }}
          >
            Today
          </span>
        )}
      </div>

      {!isToday && (
        <button type="button" onClick={() => onDateChange(today)} className="cs-btn cs-btn-ghost cs-btn-sm">
          Today
        </button>
      )}

      <button
        type="button"
        onClick={() => onDateChange(shiftDate(date, 1))}
        className="cs-btn cs-btn-ghost cs-btn-sm"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div style={{ width: 1, height: 20, background: "var(--cs-border)" }} />

      {/* Branch selector — owner only */}
      {isOwner && branches && branches.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Building2 className="h-4 w-4" style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
          <select
            value={branchId}
            onChange={(e) => {
              const params = new URLSearchParams(window.location.search);
              params.set("branchId", e.target.value);
              params.set("date", date);
              router.push(`?${params.toString()}`);
            }}
            style={{
              height: 32,
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              fontSize: "0.8125rem",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              padding: "0 0.5rem",
              minWidth: 140,
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          <Building2 className="h-4 w-4" style={{ flexShrink: 0 }} />
          {branchName}
        </div>
      )}

      <div style={{ width: 1, height: 20, background: "var(--cs-border)" }} />

      {/* Staff search */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search className="h-3.5 w-3.5" style={{ position: "absolute", left: 8, color: "var(--cs-text-muted)" }} />
        <input
          type="search"
          placeholder="Search staff..."
          value={staffSearch}
          onChange={(e) => onStaffSearchChange(e.target.value)}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem 0 1.75rem",
            minWidth: 140,
          }}
        />
      </div>

      {/* Status filter */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <ListFilter className="h-3.5 w-3.5" style={{ position: "absolute", left: 8, color: "var(--cs-text-muted)" }} />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem 0 1.75rem",
            minWidth: 120,
          }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      {/* Type filter */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <ListFilter className="h-3.5 w-3.5" style={{ position: "absolute", left: 8, color: "var(--cs-text-muted)" }} />
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem 0 1.75rem",
            minWidth: 110,
          }}
        >
          <option value="">All Types</option>
          <option value="online">Online</option>
          <option value="walkin">Walk-in</option>
          <option value="home_service">Home Service</option>
        </select>
      </div>

      <div style={{ marginLeft: "auto" }}>
        <Link
          href={viewBookingsHref}
          className="cs-btn cs-btn-primary cs-btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ClipboardList className="h-4 w-4" />
          View Bookings
        </Link>
      </div>
    </div>
  );
}
