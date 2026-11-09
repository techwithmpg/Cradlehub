"use server";

import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { readPendingCrmBookings } from "@/lib/notifications/pending-booking-queue";
import { getOnDutyCrmStaffIds } from "@/lib/notifications/pending-booking-duty";
import type { PendingCrmBookingSnapshot } from "@/lib/notifications/pending-booking-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";

export async function getCrmPendingBookingSnapshotAction(): Promise<PendingCrmBookingSnapshot> {
  const checkedAt = new Date().toISOString();
  const fallback: PendingCrmBookingSnapshot = {
    ok: false,
    pendingCount: 0,
    onDuty: false,
    first: null,
    checkedAt,
    error: "Pending confirmation reminders are temporarily unavailable.",
  };
  if (process.env.CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED !== "true") return fallback;

  const ctx = await getFrontDeskContext(); // Authenticated and branch authorized.
  if (ctx.role !== "crm" || !ctx.capabilities.canManageBookings) return fallback;

  try {
    const admin = createAdminClient();
    const [queue, onDutyStaffIds, ownStaff] = await Promise.all([
      readPendingCrmBookings({ branchId: ctx.branchId, admin }),
      getOnDutyCrmStaffIds({ branchId: ctx.branchId, admin }),
      admin
        .from("staff")
        .select("id")
        .eq("auth_user_id", ctx.userId)
        .eq("branch_id", ctx.branchId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    if (ownStaff.error) throw new Error("CRM identity could not be checked.");
    return {
      ok: true,
      pendingCount: queue.count,
      first: queue.first,
      onDuty: Boolean(ownStaff.data && onDutyStaffIds.has(ownStaff.data.id)),
      checkedAt,
    };
  } catch (error) {
    logError("crm.pending_booking_snapshot_failed", { branchId: ctx.branchId, error });
    return fallback;
  }
}
