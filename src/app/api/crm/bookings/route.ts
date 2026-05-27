import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api/get-api-context";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;
  const bookingId = searchParams.get("bookingId");

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

    const [bookings, cashSummary] = await Promise.all([
      getTodaysSchedule(ctx.branchId, resolvedDate),
      getDailyPaymentSummary(ctx.branchId, resolvedDate),
    ]);

    return NextResponse.json(
      {
        branchId: ctx.branchId,
        branchName: ctx.branchName,
        role: ctx.role,
        date: resolvedDate,
        bookings,
        cashSummary,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[api/crm/bookings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
