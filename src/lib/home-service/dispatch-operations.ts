import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { canonicalizeSystemRole } from "@/constants/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { logError } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/supabase";

import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

const uuid = z.guid("Invalid ID");

const assignDriverSchema = z.object({
  bookingId: uuid,
  driverId: uuid.nullable(),
});

export type HomeServiceMutationActor = {
  staffId: string;
  branchId: string;
  role: string;
  allowOwnerCrossBranch?: boolean;
};

export type HomeServiceOperationFailure = {
  ok: false;
  code:
    | "FORBIDDEN"
    | "SERVER_ERROR"
    | "VALIDATION_ERROR"
    | "BOOKING_NOT_FOUND"
    | "BRANCH_FORBIDDEN"
    | "NOT_HOME_SERVICE"
    | "DRIVER_NOT_FOUND"
    | "DRIVER_INACTIVE"
    | "DRIVER_WRONG_BRANCH"
    | "DRIVER_ROLE_INVALID"
    | "SAVE_FAILED";
  message: string;
};

export type HomeServiceOperationResult = { ok: true } | HomeServiceOperationFailure;

function canAccessBranch(actor: HomeServiceMutationActor, bookingBranchId: string): boolean {
  if (actor.branchId === bookingBranchId) return true;

  return actor.allowOwnerCrossBranch === true && canonicalizeSystemRole(actor.role) === "owner";
}

/**
 * Authoritative driver assignment operation used by both:
 * - hosted CradleHub server action
 * - Desktop Bearer API
 *
 * Privileged booking mutation remains server-only.
 */
export async function assignHomeServiceDriver(
  client: SupabaseClient<Database>,
  actor: HomeServiceMutationActor,
  rawInput: unknown
): Promise<HomeServiceOperationResult> {
  if (!actor.branchId || !canAccessCrmWorkspace(actor.role))
    return { ok: false, code: "FORBIDDEN", message: "CRM access is required." };
  const parsed = assignDriverSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { bookingId, driverId } = parsed.data;

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select(
      "id, branch_id, delivery_type, type, driver_id, payment_status, booking_date, start_time"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError)
    return { ok: false, code: "SERVER_ERROR", message: "Booking could not be loaded." };
  if (!booking) {
    return {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
    };
  }

  if (!canAccessBranch(actor, booking.branch_id)) {
    return {
      ok: false,
      code: "BRANCH_FORBIDDEN",
      message: "Booking is not in your branch.",
    };
  }

  const isHomeService = booking.delivery_type === "home_service" || booking.type === "home_service";

  if (!isHomeService) {
    return {
      ok: false,
      code: "NOT_HOME_SERVICE",
      message: "Driver assignment is only available for home-service bookings.",
    };
  }

  if (driverId !== null) {
    const { data: driver, error: driverError } = await client
      .from("staff")
      .select("id, branch_id, system_role, staff_type, is_active")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError)
      return { ok: false, code: "SERVER_ERROR", message: "Driver could not be loaded." };
    if (!driver) {
      return {
        ok: false,
        code: "DRIVER_NOT_FOUND",
        message: "Driver staff record not found.",
      };
    }

    if (!driver.is_active) {
      return {
        ok: false,
        code: "DRIVER_INACTIVE",
        message: "Selected driver is not active.",
      };
    }

    if (driver.branch_id !== booking.branch_id) {
      return {
        ok: false,
        code: "DRIVER_WRONG_BRANCH",
        message: "Driver must belong to the same branch as the booking.",
      };
    }

    const isDriver = driver.system_role === "driver" || driver.staff_type === "driver";

    if (!isDriver) {
      return {
        ok: false,
        code: "DRIVER_ROLE_INVALID",
        message: "Selected staff is not a driver.",
      };
    }
  }

  const admin = createAdminClient();

  const { data: updatedRows, error: updateError } = await admin
    .from("bookings")
    .update({ driver_id: driverId })
    .eq("id", bookingId)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length === 0) {
    logError("home_service.driver_assignment.failed", {
      error: updateError,
      bookingId,
      branchId: booking.branch_id,
      staffId: actor.staffId,
    });

    return {
      ok: false,
      code: "SAVE_FAILED",
      message: "Driver assignment could not be saved.",
    };
  }

  // Preserve the existing hosted notification semantics exactly:
  // notifications change only when the booking is already paid.
  if (booking.driver_id !== driverId && booking.payment_status === "paid") {
    await resolveNotificationsForEntity("booking", booking.id, "driver", "home_service_assigned");

    if (booking.driver_id) {
      await createNotification({
        branchId: booking.branch_id,
        targetWorkspace: "driver",
        recipientStaffId: booking.driver_id,
        type: "booking_reassigned",
        title: "Home Service trip reassigned",
        body: `The trip on ${booking.booking_date} at ${booking.start_time} is no longer assigned to you.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: `/driver/jobs/${booking.id}`,
        priority: "normal",
        dedupeKey: `booking:${booking.id}:driver_reassigned_from:${booking.driver_id}`,
      });
    }

    if (driverId) {
      await createNotification({
        branchId: booking.branch_id,
        targetWorkspace: "driver",
        recipientStaffId: driverId,
        type: "home_service_assigned",
        title: "Home Service trip assigned",
        body: `A confirmed trip is assigned to you on ${booking.booking_date} at ${booking.start_time}.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: `/driver/jobs/${booking.id}`,
        priority: "high",
        requiresAction: true,
        dedupeKey: `booking:${booking.id}:driver_assignment:${driverId}`,
      });
    }
  }

  revalidatePath("/manager/control");
  revalidatePath("/crm/control");
  revalidatePath("/crm/today");
  revalidatePath("/driver");

  invalidateCrmWorkspace(booking.branch_id);

  return { ok: true };
}
