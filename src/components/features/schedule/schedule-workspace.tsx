"use client";

import { useState, useCallback } from "react";
import { ScheduleToolbar } from "./schedule-toolbar";
import { ScheduleKpiCards } from "./schedule-kpi-cards";
import { ScheduleBoardPanel } from "./schedule-board-panel";
import { ScheduleDetailsPanel } from "./schedule-details-panel";
import { ScheduleAlertsPanel } from "./schedule-alerts-panel";
import type { ScheduleViewMode } from "./schedule-mode-switcher";
import type { DailyScheduleStaffRow, DailyScheduleBooking } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];
type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

export type WorkspaceContext = "owner" | "manager" | "crm";

export type ScheduleWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole: string;
  branchId: string;
  branchName: string;
  date: string;
  branches?: { id: string; name: string }[];
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  stats: {
    total: number;
    confirmed: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    no_show: number;
  };
  viewBookingsHref: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
};

function computeAlerts(staffRows: DailyScheduleStaffRow[]): import("./schedule-alerts-panel").ScheduleAlert[] {
  const alerts: import("./schedule-alerts-panel").ScheduleAlert[] = [];

  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.type === "home_service" && booking.status !== "cancelled" && booking.status !== "no_show") {
        alerts.push({
          id: `travel-${booking.id}`,
          type: "travel_buffer",
          title: "Travel Buffer Risk",
          description: `${booking.service} — ${booking.customer}`,
        });
      }
      if (booking.type !== "home_service" && !booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        alerts.push({
          id: `missing-${booking.id}`,
          type: "missing_assignment",
          title: "Missing Assignment",
          description: `${booking.service} — no room assigned`,
        });
      }
    }
  }

  // Room conflicts: two bookings using same resource at same time
  const resourceBookings = new Map<string, DailyScheduleBooking[]>();
  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        const list = resourceBookings.get(booking.resource_id) ?? [];
        list.push(booking);
        resourceBookings.set(booking.resource_id, list);
      }
    }
  }
  for (const list of resourceBookings.values()) {
    if (list.length > 1) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            alerts.push({
              id: `conflict-${a.id}-${b.id}`,
              type: "room_conflict",
              title: "Room Conflict",
              description: `Overlapping bookings on same resource`,
            });
          }
        }
      }
    }
  }

  return alerts;
}

export function ScheduleWorkspace({
  workspaceContext,
  viewerRole,
  branchId,
  branchName,
  date,
  branches,
  staffRows,
  branchResources,
  stats,
  viewBookingsHref,
  statusAction,
  paymentAction,
}: ScheduleWorkspaceProps) {
  const [staffSearch, setStaffSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("staff");

  let filteredRows = staffRows;

  if (staffSearch.trim()) {
    const term = staffSearch.toLowerCase();
    filteredRows = filteredRows.filter((s) => s.staff_name.toLowerCase().includes(term));
  }

  if (statusFilter || typeFilter) {
    filteredRows = filteredRows.map((s) => ({
      ...s,
      bookings: s.bookings.filter((b) => {
        if (statusFilter && b.status !== statusFilter) return false;
        if (typeFilter && b.type !== typeFilter) return false;
        return true;
      }),
    }));
  }

  const selectedBookingWithStaff = (() => {
    if (!selectedBookingId) return null;
    for (const staff of filteredRows) {
      const booking = staff.bookings.find((b) => b.id === selectedBookingId);
      if (booking) return { booking, staff };
    }
    return null;
  })();

  const alertList = computeAlerts(filteredRows);
  const kpiData = {
    total: stats.total,
    confirmed: stats.confirmed,
    in_progress: stats.in_progress,
    completed: stats.completed,
    available_staff: filteredRows.filter((s) => s.work_start && s.work_end).length,
    alerts: alertList.length,
  };

  const handleBookingClick = useCallback((bookingId: string) => {
    setSelectedBookingId((current) => (current === bookingId ? null : bookingId));
  }, []);

  const handleDateChange = useCallback(
    (nextDate: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("date", nextDate);
      window.location.search = params.toString();
    },
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--cs-text)", fontFamily: "var(--font-display)", margin: 0 }}>
            Schedule
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", margin: "0.25rem 0 0" }}>
            Manage staff availability, bookings, and resources for today.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <ScheduleToolbar
        workspaceContext={workspaceContext}
        branchId={branchId}
        branchName={branchName}
        date={date}
        branches={branches}
        staffSearch={staffSearch}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onStaffSearchChange={setStaffSearch}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onDateChange={handleDateChange}
        viewBookingsHref={viewBookingsHref}
      />

      {/* KPI Cards */}
      <ScheduleKpiCards data={kpiData} />

      {/* Main content: board + details panel */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "1rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
          <ScheduleBoardPanel
            branchId={branchId}
            branchName={branchName}
            date={date}
            staffRows={filteredRows}
            branchResources={branchResources}
            onBookingClick={handleBookingClick}
            selectedBookingId={selectedBookingId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {alertList.length > 0 && <ScheduleAlertsPanel alerts={alertList} />}
        </div>

        <ScheduleDetailsPanel
          booking={selectedBookingWithStaff?.booking ?? null}
          staffName={selectedBookingWithStaff?.staff.staff_name ?? ""}
          branchResources={branchResources}
          date={date}
          viewerRole={viewerRole}
          statusAction={statusAction}
          paymentAction={paymentAction}
          onClose={() => setSelectedBookingId(null)}
        />
      </div>
    </div>
  );
}
