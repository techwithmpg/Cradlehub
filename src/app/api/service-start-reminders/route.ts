import { NextRequest, NextResponse } from "next/server";

import { logError } from "@/lib/logger";
import { runTherapistServiceStartPush } from "@/lib/bookings/therapist-service-start-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ready for a separately approved scheduler. Nothing in vercel.json invokes it.
 * A known CRON_SECRET and explicit feature flag are required in all environments.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.CRADLEHUB_THERAPIST_START_PUSH_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Reminders disabled" }, { status: 503 });
  }
  try {
    const result = await runTherapistServiceStartPush();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    logError("service_start_push.route_failed", { error });
    return NextResponse.json({ ok: false, error: "Reminder processing failed" }, { status: 500 });
  }
}
