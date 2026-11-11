"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { emitWorkspaceEntityDelta } from "@/lib/workspace/entity-delta-bus";

/**
 * Single multiplexed Supabase Realtime listener per branch.
 * Listens to row-level INSERT/UPDATE events on `bookings` and `financial_transactions`
 * and broadcasts surgical in-memory deltas (`emitWorkspaceEntityDelta`) across all
 * retained modules (Today, Bookings, Cash Flow) so they self-update without full reloads.
 */
export function WorkspaceEntityDeltaBridge({ branchId }: { branchId: string }) {
  useEffect(() => {
    if (!branchId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`cradlehub-entity-delta:${branchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const row = (payload.new ?? null) as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string") return;

          emitWorkspaceEntityDelta({
            kind: payload.eventType === "INSERT" ? "booking.upserted" : "booking.status_patched",
            branchId,
            timestamp: Date.now(),
            booking: {
              id: row.id,
              branchId,
              bookingDate: typeof row.booking_date === "string" ? row.booking_date : undefined,
              orderId: typeof row.order_id === "string" ? row.order_id : null,
              status: typeof row.status === "string" ? row.status : undefined,
              bookingProgressStatus:
                typeof row.booking_progress_status === "string"
                  ? row.booking_progress_status
                  : null,
              paymentStatus:
                typeof row.payment_status === "string" ? row.payment_status : null,
              paymentMethod:
                typeof row.payment_method === "string" ? row.payment_method : null,
              amountPaid:
                typeof row.amount_paid === "number"
                  ? row.amount_paid
                  : typeof row.amount_paid === "string"
                    ? Number(row.amount_paid)
                    : null,
              staffId: typeof row.staff_id === "string" ? row.staff_id : null,
              resourceId: typeof row.resource_id === "string" ? row.resource_id : null,
              startTime: typeof row.start_time === "string" ? row.start_time : undefined,
              endTime: typeof row.end_time === "string" ? row.end_time : undefined,
              deliveryType:
                typeof row.delivery_type === "string" ? row.delivery_type : null,
            },
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "financial_transactions",
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const row = (payload.new ?? null) as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string") return;
          if (row.status !== "posted") return;

          const sourceType = typeof row.source_type === "string" ? row.source_type : "";
          const sourceId = typeof row.source_id === "string" ? row.source_id : null;
          const amount =
            typeof row.amount === "number"
              ? row.amount
              : typeof row.amount === "string"
                ? Number(row.amount)
                : 0;

          emitWorkspaceEntityDelta({
            kind: "financial.payment_recorded",
            branchId,
            timestamp: Date.now(),
            payment: {
              branchId,
              businessDate:
                typeof row.business_date === "string"
                  ? row.business_date
                  : new Date().toISOString().slice(0, 10),
              transactionId: row.id,
              orderId: sourceType === "booking_order" ? sourceId : null,
              bookingId: sourceType === "booking" ? sourceId : null,
              amount: Number.isFinite(amount) ? amount : 0,
              paymentMethod:
                typeof row.payment_method === "string" ? row.payment_method : "cash",
              occurredAt:
                typeof row.created_at === "string"
                  ? row.created_at
                  : new Date().toISOString(),
            },
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  return null;
}
