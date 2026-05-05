"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createWalkinBookingSchema } from "@/lib/validations/booking";
import { assertSlotAvailable } from "@/lib/engine/availability";
import { isResourceAvailable, autoAssignBookingResource } from "@/lib/engine/resource-availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { SlotUnavailableError } from "@/types/errors";
import { revalidatePath } from "next/cache";

export async function createWalkinBookingAction(rawInput: unknown) {
  const parsed = createWalkinBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  // Get auth context — manager's branch_id
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .single();

  const allowedRoles = [
    "owner", "manager", "assistant_manager", "store_manager",
    "crm", "csr", "csr_head", "csr_staff",
  ];

  if (!me && isDevAuthBypassEnabled()) {
    // Dev bypass: allow walk-in creation with a dummy branch
    // This requires a real branch_id to validate slots — fall through to error
    // since we can't safely invent a branch_id for booking validation.
    return { success: false, error: "Dev bypass active but no branch_id available. Create a staff record with branch_id to test walk-in bookings." };
  }

  if (!me || !allowedRoles.includes(me.system_role)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!me.branch_id) {
    return { success: false, error: "Manager is not assigned to a branch" };
  }

  const branchId = me.branch_id;

  try {
    const endTime = await computeEndTime(d.startTime, d.serviceId);

    let resolvedResourceId = d.resourceId ?? null;

    // ── Auto-assign room if not provided ──────────────────────────────────
    if (d.type !== "home_service" && !resolvedResourceId) {
      resolvedResourceId = await autoAssignBookingResource({
        branchId,
        date: d.date,
        startTime: d.startTime,
        endTime,
      });

      if (!resolvedResourceId) {
        return {
          success: false,
          error: "No room/bed is available for this time. Please assign a space manually or choose another time.",
        };
      }
    }

    // Verify resource availability if provided manually
    if (d.resourceId) {
      const isAvailable = await isResourceAvailable({
        resourceId: d.resourceId,
        date: d.date,
        startTime: d.startTime,
        endTime,
      });
      if (!isAvailable) {
        return {
          success: false,
          error: "The selected room/bed is already booked for this time.",
        };
      }
    }

    // Verify slot
    await assertSlotAvailable({
      branchId,
      serviceId: d.serviceId,
      staffId: d.staffId,
      date: d.date,
      startTime: d.startTime,
    });

    const metadata = await buildBookingSnapshot(branchId, d.serviceId, d.notes);
    const admin = createAdminClient();

    // Upsert customer
    const { data: customerId, error: custErr } = await admin.rpc("upsert_customer", {
      p_phone: d.phone,
      p_full_name: d.fullName,
      p_email: d.email || undefined,
    });
    if (custErr || !customerId) throw new Error("Failed to resolve customer");
    const resolvedCustomerId = String(customerId);

    // Set staff attribution for trigger (booking_events.changed_by)
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
      }
    )
      .rpc("set_config", {
        setting: "app.current_staff_id",
        value: staffRow?.id ?? "",
        is_local: true,
      })
      .catch(() => {}); // best-effort

    const { data: booking, error: bookErr } = await admin
      .from("bookings")
      .insert({
        branch_id: branchId,
        service_id: d.serviceId,
        staff_id: d.staffId,
        resource_id: resolvedResourceId,
        customer_id: resolvedCustomerId,
        booking_date: d.date,
        start_time: d.startTime,
        end_time: endTime,
        type: d.type,
        status: "confirmed",
        travel_buffer_mins:
          d.type === "home_service" ? (d.travelBufferMins ?? 30) : null,
        metadata,
      })
      .select("id")
      .single();

    if (bookErr || !booking) throw new Error("Failed to create booking");

    revalidatePath("/manager");
    revalidatePath("/manager/bookings");

    return { success: true, bookingId: booking.id };
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return { success: false, error: err.message };
    }
    console.error("[createWalkin] Error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
