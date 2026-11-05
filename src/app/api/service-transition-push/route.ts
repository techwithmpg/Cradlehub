import { NextRequest, NextResponse } from "next/server";

import { logError } from "@/lib/logger";
import { runServiceTransitionPushConsumer } from "@/lib/notifications/push/service-transition-outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ready for a separately approved Vercel Cron schedule; none is installed here. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runServiceTransitionPushConsumer({ batchSize: 6, maxBatches: 4 });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    logError("service_transition.push_consumer_failed", { error });
    return NextResponse.json({ ok: false, error: "Push consumer failed" }, { status: 500 });
  }
}
