import type { NextRequest } from "next/server";
import {
  withDesktopBookingContext,
  desktopJson,
  desktopFailure,
} from "@/lib/bookings/desktop-booking-contract";
import { getDesktopTodayData } from "@/lib/today/desktop-today-contract";

/**
 * GET /api/desktop/v1/today
 *
 * Returns authoritative operational Today workspace data for the authenticated
 * desktop operator branch:
 * - context (branchId, branchName, businessDate, role)
 * - summary (operational booking & stage counts)
 * - queue (normalized operational booking queue)
 * - readiness (operational readiness issues & status)
 * - attendance (scan activity snapshot)
 * - notifications (action-required operational notifications)
 *
 * Financial data (revenue, collected, expected, unpaid, payment reference) is strictly excluded.
 */
export async function GET(request: NextRequest) {
  return withDesktopBookingContext(request, async (ctx) => {
    const branchId = ctx.me.branch_id;
    const branch = await ctx.supabase
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .maybeSingle();

    if (branch.error) throw branch.error;
    if (!branch.data) {
      return desktopFailure(
        "BRANCH_NOT_FOUND",
        "The authenticated Today branch is unavailable.",
        403
      );
    }

    const data = await getDesktopTodayData(ctx, branch.data.name);
    return desktopJson({
      ok: true,
      data,
    });
  });
}
