"use client";

import { useMemo } from "react";
import { ScheduleWorkspace } from "../schedule-workspace";
import { DailyTimelineRightRail } from "./daily-timeline-right-rail";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

function computeAlerts(staffRows: DailyScheduleStaffRow[]) {
  const alerts: { id: string; type: string; title: string; description: string }[] = [];

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

  const resourceBookings = new Map<string, import("@/lib/queries/schedule").DailyScheduleBooking[]>();
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

export function DailyTimelineTab({
  branchId,
  branchName,
  date,
  staffRows,
  branchResources,
  stats,
}: {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  stats: { total: number; confirmed: number; in_progress: number; completed: number; cancelled: number; no_show: number };
}) {
  const alertList = useMemo(() => computeAlerts(staffRows), [staffRows]);

  return (
    <ScheduleWorkspace
      workspaceContext="crm"
      viewerRole="crm"
      branchId={branchId}
      branchName={branchName}
      date={date}
      branches={[{ id: branchId, name: branchName }]}
      staffRows={staffRows}
      branchResources={branchResources}
      stats={stats}
      viewBookingsHref="/crm/bookings"
      showToolbar={false}
      showKpiCards={false}
      rightRailExtras={<DailyTimelineRightRail staffRows={staffRows} alertList={alertList} />}
    />
  );
}
