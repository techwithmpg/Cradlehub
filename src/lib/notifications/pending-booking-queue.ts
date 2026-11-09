import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PENDING_CRM_BOOKING_STATUS,
  PENDING_CRM_SNAPSHOT_LIMIT,
  type PendingCrmBooking,
} from "@/lib/notifications/pending-booking-policy";

type AdminClient = ReturnType<typeof createAdminClient>;
type Relation<T> = T | T[] | null;
type Row = {
  id: string;
  booking_date: string;
  start_time: string;
  created_at: string;
  customers: Relation<{ full_name: string | null }>;
  services: Relation<{ name: string | null }>;
};
function first<T>(relation: Relation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

/**
 * The bookings table remains the ONLY authority; notifications never decide
 * what is pending. Count is exact even when the detail sample is bounded.
 * Include old overnight requests, not just the current business date.
 */
export async function readPendingCrmBookings(input: {
  branchId: string;
  admin?: AdminClient;
}): Promise<{ count: number; first: PendingCrmBooking | null }> {
  const admin = input.admin ?? createAdminClient();
  const { data, count, error } = await admin
    .from("bookings")
    .select("id, booking_date, start_time, created_at, customers(full_name), services(name)", { count: "exact" })
    .eq("branch_id", input.branchId)
    .eq("status", PENDING_CRM_BOOKING_STATUS)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(PENDING_CRM_SNAPSHOT_LIMIT);
  if (error) throw new Error("Pending booking queue could not be loaded.");
  const rows = (data ?? []) as Row[];
  const row = rows[0];
  return {
    count: count ?? rows.length,
    first: row
      ? {
          id: row.id,
          bookingDate: row.booking_date,
          startTime: row.start_time,
          createdAt: row.created_at,
          customerName: first(row.customers)?.full_name?.trim() || "Customer",
          serviceName: first(row.services)?.name || "Service",
        }
      : null,
  };
}
