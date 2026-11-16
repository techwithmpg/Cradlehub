import { NextRequest, NextResponse } from "next/server";
import { processAttendanceV2 } from "@/lib/attendance/v2-processor";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase Cron ownership only; no schedule is installed by this route. */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await processAttendanceV2() });
  } catch (error) {
    logError("attendance.v2.processing_failed", { error });
    return NextResponse.json({ ok: false, error: "Attendance processing failed" }, { status: 500 });
  }
}
