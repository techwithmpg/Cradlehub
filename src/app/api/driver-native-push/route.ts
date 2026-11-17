import { NextRequest, NextResponse } from "next/server";
import { processDriverNativePush } from "@/lib/driver/native-push";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, result: await processDriverNativePush() });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Native push could not be processed." },
      { status: 503 }
    );
  }
}
