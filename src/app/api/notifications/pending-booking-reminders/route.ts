import { NextRequest, NextResponse } from "next/server";
import { runPendingBookingPushReminders } from "@/lib/notifications/pending-booking-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never exposed to browser clients. Requires a protected Vercel Cron secret. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let autoCompletedCount = 0;
  let autoCompleteError: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("complete_due_service_sessions", { p_limit: 100 });
    if (error) {
      autoCompleteError = error.message;
      logError("crm.auto_complete_due_sessions_failed", { error });
    } else {
      autoCompletedCount = Array.isArray(data) ? data.length : 0;
    }
  } catch (err) {
    autoCompleteError = err instanceof Error ? err.message : "Unknown error";
    logError("crm.auto_complete_due_sessions_exception", { error: err });
  }

  if (process.env.CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED !== "true") {
    return NextResponse.json(
      { ok: autoCompleteError === null, autoCompletedCount, autoCompleteError, reminders: "disabled" },
      { status: autoCompleteError === null ? 200 : 500 }
    );
  }

  try {
    const stats = await runPendingBookingPushReminders();
    return NextResponse.json(
      { ok: stats.failed === 0 && autoCompleteError === null, autoCompletedCount, autoCompleteError, stats },
      { status: stats.failed === 0 && autoCompleteError === null ? 200 : 500 }
    );
  } catch (error) {
    logError("crm.pending_booking_push_cron_failed", { error });
    return NextResponse.json(
      { ok: false, autoCompletedCount, autoCompleteError, error: "Pending booking reminder job failed" },
      { status: 500 }
    );
  }
}
