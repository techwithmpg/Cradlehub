import "server-only";
import { NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import type { CrmActionContext, BookingOperationResult } from "./crm-booking-operations";
import { logError } from "@/lib/logger";

export function desktopJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function desktopFailure(code: string, message: string, status: number) {
  return desktopJson({ ok: false, code, message }, status);
}
export async function withDesktopBookingContext(
  request: Request,
  run: (ctx: CrmActionContext) => Promise<NextResponse>
) {
  try {
    const auth = await verifyDesktopBearerAuth(request);
    if (!auth.ok) return desktopFailure(auth.code, auth.message, auth.status);
    const staff = auth.operator.staff;
    if (!staff?.branch_id || !auth.operator.staffRole)
      return desktopFailure(
        "STAFF_NOT_FOUND",
        "An active staff profile with a branch is required.",
        403
      );
    return await run({
      supabase: auth.client,
      authUserId: auth.user.id,
      me: { id: staff.id, branch_id: staff.branch_id, system_role: auth.operator.staffRole },
      allowOwnerCrossBranch: false,
    });
  } catch (error) {
    logError("api.desktop.booking_contract.failed", { error });
    return desktopFailure(
      "SERVER_ERROR",
      "The request could not be completed. Please refresh and try again.",
      500
    );
  }
}
export function bookingOperationResponse(result: BookingOperationResult) {
  if (result.success)
    return desktopJson({
      ok: true,
      data: {
        ...(result.releasedNow === undefined
          ? {}
          : { releasedNow: result.releasedNow, releaseAt: result.releaseAt }),
      },
    });
  const code = result.code ?? "BOOKING_ACTION_REJECTED";
  const status =
    code === "booking_missing"
      ? 404
      : ["booking_wrong_branch", "booking_permission_denied", "FORBIDDEN"].includes(code)
        ? 403
        : ["SERVER_ERROR", "booking_load_failed"].includes(code)
          ? 500
          : code === "VALIDATION_ERROR"
            ? 400
            : 409;
  return desktopFailure(
    code,
    status === 500
      ? "Booking operation could not be completed. Please refresh and try again."
      : (result.error ?? "Booking action rejected."),
    status
  );
}
/** A bearer/RLS read before exposing details or scoring candidates. */
export async function checkDesktopBooking(
  ctx: CrmActionContext,
  bookingId: string,
  homeServiceOnly = false
) {
  const { data, error } = await ctx.supabase
    .from("bookings")
    .select("id, branch_id, type, delivery_type")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return desktopFailure("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (data.branch_id !== ctx.me.branch_id)
    return desktopFailure("BRANCH_FORBIDDEN", "Booking is not in your branch.", 403);
  if (homeServiceOnly && data.type !== "home_service" && data.delivery_type !== "home_service")
    return desktopFailure("NOT_HOME_SERVICE", "This action requires a Home Service booking.", 400);
  return null;
}
