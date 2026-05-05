import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isResourceAvailable } from "@/lib/engine/resource-availability";
import { computeEndTime } from "@/lib/engine/booking-time";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const resourceId = searchParams.get("resourceId");
  const date = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const serviceId = searchParams.get("serviceId");
  const excludeBookingId = searchParams.get("excludeBookingId") ?? undefined;

  if (!resourceId || !date || !startTime || !serviceId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const endTime = await computeEndTime(startTime, serviceId);
    const available = await isResourceAvailable({
      resourceId,
      date,
      startTime,
      endTime,
      excludeBookingId
    });

    return NextResponse.json({ available });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Check failed" }, { status: 500 });
  }
}
