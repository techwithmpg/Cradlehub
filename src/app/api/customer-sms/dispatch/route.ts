import { NextRequest, NextResponse } from "next/server";

import { dispatchCustomerSms } from "@/lib/sms/dispatch";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Intentionally NOT registered in vercel.json until scheduler capability,
// database installation, consent, sender approval and owner release gates pass.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.CRADLE_SMS_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Customer SMS disabled" }, { status: 503 });
  }
  try {
    const result = await dispatchCustomerSms();
    return NextResponse.json({ ok: true, result }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Never return provider errors or customer details to an HTTP caller.
    logError("customer_sms.dispatch_failed", { error });
    return NextResponse.json({ ok: false, error: "SMS dispatch unavailable" }, { status: 500 });
  }
}
