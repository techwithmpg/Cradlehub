import { NextRequest, NextResponse } from "next/server";
import { getCrmApiContext } from "@/lib/api/get-api-context";
import { createClient } from "@/lib/supabase/server";
import { getCrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const auth = await getCrmApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const ctx = auth.context;

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? undefined;
  const upcoming = searchParams.get("tab") === "upcoming";
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("highlight") ?? undefined;

  try {
    const supabase = await createClient();
    const data = await getCrmBookingsOperationalData({
      branchId: ctx.branchId,
      branchName: ctx.branchName,
      role: ctx.role,
      date,
      upcoming,
      bookingId,
      client: supabase,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Booking is unavailable for this branch.") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    logError("Failed to load CRM bookings command center", {
      error: err,
      action: "api.crm.bookings",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
