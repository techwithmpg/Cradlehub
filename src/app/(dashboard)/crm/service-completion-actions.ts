"use server";

import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrderReadyForPayment } from "@/lib/bookings/service-completion-payment-ready";
import { logError } from "@/lib/logger";

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;

export type CrmPaymentReadyItem = {
  notificationId: string;
  bookingId: string;
  recipientName: string;
  serviceName: string;
  completedAt: string;
  automaticallyCompleted: boolean;
};

/**
 * Read-only, branch-scoped snapshot. Notifications are produced after the
 * authoritative service completion; client timers cannot mark bookings completed.
 */
export async function getCrmPaymentReadySnapshotAction(): Promise<{
  ok: boolean;
  items: CrmPaymentReadyItem[];
}> {
  const { branchId } = await getFrontDeskContext();
  if (!branchId) return { ok: false, items: [] };
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: alerts, error } = await admin.from("workspace_notifications")
    .select("id, entity_id, metadata, created_at")
    .eq("branch_id", branchId).eq("target_workspace", "crm")
    .eq("type", "booking_status_changed")
    .in("status", ["unread", "read"])
    .gte("created_at", since)
    .order("created_at", { ascending: false }).limit(100);
  if (error) {
    logError("crm.payment_ready.notifications_failed", { branchId, error });
    return { ok: false, items: [] };
  }
  const completionAlerts = (alerts ?? []).filter((alert) => {
    const metadata = alert.metadata;
    return alert.entity_id && metadata && typeof metadata === "object" &&
      !Array.isArray(metadata) && metadata.service_transition === "completed";
  });
  if (completionAlerts.length === 0) return { ok: true, items: [] };

  const ids = [...new Set(completionAlerts.map((item) => item.entity_id as string))];
  const { data: bookings, error: bookingError } = await admin.from("bookings")
    .select(`id, branch_id, order_id, status, booking_progress_status, payment_status,
      session_completed_at, session_completion_source,
      customers(full_name), booking_attendees!attendee_id(display_name), services(name)`)
    .eq("branch_id", branchId).in("id", ids);
  if (bookingError) {
    logError("crm.payment_ready.bookings_failed", { branchId, error: bookingError });
    return { ok: false, items: [] };
  }
  const byId = new Map((bookings ?? []).map((booking) => [booking.id, booking]));
  const orderIds = [...new Set((bookings ?? []).flatMap((booking) => booking.order_id ? [booking.order_id] : []))];
  let siblings: Array<{ order_id: string | null; status: string; booking_progress_status: string | null; payment_status: string | null; session_completed_at: string | null }> = [];
  if (orderIds.length > 0) {
    // A truncated group cannot be treated as ready for checkout.
    const { data, error: siblingsError } = await admin.from("bookings")
      .select("order_id, status, booking_progress_status, payment_status, session_completed_at")
      .eq("branch_id", branchId).in("order_id", orderIds).limit(1000);
    if (siblingsError || (data?.length ?? 0) === 1000) {
      logError("crm.payment_ready.siblings_failed", { branchId, error: siblingsError ?? "Group limit reached" });
      return { ok: false, items: [] };
    }
    siblings = data ?? [];
  }
  return {
    ok: true,
    items: completionAlerts.flatMap((alert): CrmPaymentReadyItem[] => {
      const booking = byId.get(alert.entity_id as string);
      if (!booking || !booking.session_completed_at || booking.status !== "completed") return [];
      const lines = booking.order_id
        ? siblings.filter((line) => line.order_id === booking.order_id)
        : [booking];
      if (!isOrderReadyForPayment(lines)) return [];
      const attendee = first(booking.booking_attendees as Relation<{ display_name: string | null }>);
      const customer = first(booking.customers as Relation<{ full_name: string | null }>);
      const service = first(booking.services as Relation<{ name: string | null }>);
      return [{
        notificationId: alert.id,
        bookingId: booking.id,
        recipientName: attendee?.display_name?.trim() || customer?.full_name?.trim() || "Guest",
        serviceName: service?.name?.trim() || "Service",
        completedAt: booking.session_completed_at,
        automaticallyCompleted: booking.session_completion_source === "auto_due",
      }];
    }),
  };
}
