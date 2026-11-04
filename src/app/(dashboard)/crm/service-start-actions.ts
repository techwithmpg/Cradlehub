"use server";

import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledStartMs, serviceStartReminderQueue, type ServiceStartCandidate, type ServiceStartReminder } from "@/lib/bookings/service-start-reminders";
import { logError } from "@/lib/logger";

type Relation<T> = T | T[] | null;
type ReminderRow = ServiceStartCandidate & {
  order_id: string | null;
  customers: Relation<{ full_name: string | null }>;
  booking_attendees: Relation<{ display_name: string | null }>;
  services: Relation<{ name: string | null; duration_minutes: number | null }>;
  staff: Relation<{ full_name: string | null }>;
  booking_orders: Relation<{ order_number: string | null }>;
};

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function manilaSlot(value: Date): { date: string; time: string } {
  const local = new Date(value.getTime() + 8 * 60 * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 19) };
}

export async function getCrmServiceStartSnapshotAction(): Promise<{
  ok: boolean;
  serverNow: string;
  actions: ServiceStartReminder[];
}> {
  const now = new Date();
  const serverNow = now.toISOString();
  const { branchId } = await getFrontDeskContext();
  const lower = manilaSlot(new Date(now.getTime() - 15 * 60_000));
  const upper = manilaSlot(new Date(now.getTime() + 2 * 60_000));
  const admin = createAdminClient();
  const dates = lower.date === upper.date ? [lower.date] : [lower.date, upper.date];
  const pages = await Promise.all(dates.map(async (date) => {
    let query = admin.from("bookings")
      .select(`id, order_id, booking_date, start_time, status, booking_progress_status, session_started_at,
      staff_id, resource_id, delivery_type,
      customers(full_name), booking_attendees!attendee_id(display_name),
      services(name, duration_minutes), staff!staff_id(full_name), booking_orders!order_id(order_number)`)
      .eq("branch_id", branchId).eq("booking_date", date).eq("status", "confirmed");
    if (date === lower.date) query = query.gte("start_time", lower.time);
    if (date === upper.date) query = query.lte("start_time", upper.time);
    return query.order("start_time").limit(500);
  }));
  const failure = pages.find((page) => page.error);
  if (failure?.error) {
    logError("crm.service_start_snapshot_failed", { branchId, error: failure.error });
    return { ok: false, serverNow, actions: [] };
  }
  if (pages.some((page) => (page.data?.length ?? 0) === 500)) {
    logError("crm.service_start_snapshot_limit_reached", { branchId });
    return { ok: false, serverNow, actions: [] };
  }
  const due = serviceStartReminderQueue(pages.flatMap((page) => page.data ?? []) as unknown as ReminderRow[], now.getTime());
  const orderIds = [...new Set(due.flatMap((row) => row.order_id ? [row.order_id] : []))];
  const groupOrders = new Set<string>();
  if (orderIds.length > 0) {
    const siblings = await admin.from("bookings").select("order_id")
      .eq("branch_id", branchId).in("order_id", orderIds).limit(1000);
    if (siblings.error) logError("crm.service_start_group_lookup_failed", { branchId, error: siblings.error });
    const counts = new Map<string, number>();
    for (const sibling of siblings.data ?? []) {
      if (!sibling.order_id) continue;
      const count = (counts.get(sibling.order_id) ?? 0) + 1;
      counts.set(sibling.order_id, count);
      if (count > 1) groupOrders.add(sibling.order_id);
    }
  }
  const resourceIds = [...new Set(due.flatMap((row) => row.resource_id ? [row.resource_id] : []))];
  const roomNames = new Map<string, string>();
  if (resourceIds.length > 0) {
    const rooms = await admin.from("branch_resources")
      .select("id, name").eq("branch_id", branchId).in("id", resourceIds);
    if (rooms.error) logError("crm.service_start_room_lookup_failed", { branchId, error: rooms.error });
    for (const room of rooms.data ?? []) roomNames.set(room.id, room.name);
  }
  return {
    ok: true,
    serverNow,
    actions: due.map((row): ServiceStartReminder => ({
      bookingId: row.id,
      recipientName: first(row.booking_attendees)?.display_name?.trim()
        || first(row.customers)?.full_name?.trim() || "Guest",
      serviceName: first(row.services)?.name || "Service",
      durationMinutes: Math.max(1, first(row.services)?.duration_minutes ?? 60),
      scheduledStart: row.start_time,
      scheduledAtIso: new Date(scheduledStartMs(row)).toISOString(),
      therapistName: first(row.staff)?.full_name || "Unassigned",
      roomName: row.resource_id ? roomNames.get(row.resource_id) || "Assigned room" : "No room assigned",
      groupReference: row.order_id && groupOrders.has(row.order_id)
        ? first(row.booking_orders)?.order_number || row.order_id : null,
    })),
  };
}
