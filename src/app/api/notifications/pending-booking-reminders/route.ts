import { NextRequest, NextResponse } from "next/server";
import { runPendingBookingPushReminders } from "@/lib/notifications/pending-booking-push";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never exposed to browser clients. Requires a protected Vercel Cron secret. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Pending booking reminders disabled" }, { status: 503 });
  }
  try {
    const stats = await runPendingBookingPushReminders();
    return NextResponse.json({ ok: stats.failed === 0, stats }, { status: stats.failed === 0 ? 200 : 500 });
  } catch (error) {
    logError("crm.pending_booking_push_cron_failed", { error });
    return NextResponse.json({ ok: false, error: "Pending booking reminder job failed" }, { status: 500 });
  }
}
