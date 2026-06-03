import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api/get-api-context";
import { getCrmBookingsCommandCenterRows, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("highlight");
  try {
    // If a bookingId was provided but no date, look up the booking's date
    let resolvedDate = date;
    if (bookingId && !searchParams.get("date")) {
      const supabase = await createClient();
      const { data: ref } = await supabase
        .from("bookings")
        .select("booking_date")
        .eq("id", bookingId)
        .maybeSingle();
      if (ref?.booking_date) resolvedDate = ref.booking_date;
    }

    const [bookings, cashSummary, waitlistResult] = await Promise.all([
      getCrmBookingsCommandCenterRows(ctx.branchId, resolvedDate),
      getDailyPaymentSummary(ctx.branchId, resolvedDate),
      getWaitlistAction(ctx.branchId),
    ]);

    return NextResponse.json(
      {
        branchId: ctx.branchId,
        branchName: ctx.branchName,
        role: ctx.role,
        date: resolvedDate,
        bookings,
        waitlistRows: waitlistResult.ok ? waitlistResult.data : [],
        cashSummary,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    logError("Failed to load CRM bookings command center", {
      error: err,
      action: "api.crm.bookings",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
