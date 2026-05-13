import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";

const paramsSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const branchId = searchParams.get("branchId");
  const date = searchParams.get("date");

  if (!branchId || !date) {
    return NextResponse.json({ error: "branchId and date are required" }, { status: 400 });
  }

  const parsed = paramsSchema.safeParse({ branchId, date });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid parameters" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const [{ data, error }, rules] = await Promise.all([
    supabase
      .from("bookings")
      .select("start_time, end_time, metadata")
      .eq("branch_id", parsed.data.branchId)
      .eq("booking_date", parsed.data.date)
      .eq("delivery_type", "home_service")
      .in("status", ["pending", "confirmed", "in_progress"]),
    getBranchBookingRulesOrDefault(parsed.data.branchId),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type BookingRow = { start_time: string; end_time: string; metadata: Record<string, unknown> | null };

  const slots = ((data ?? []) as BookingRow[]).map((b) => ({
    start_time: b.start_time,
    end_time: b.end_time,
    zone: (b.metadata?.home_service_address as Record<string, string> | undefined)?.zone ?? null,
  }));

  return NextResponse.json({
    slots,
    driverCapacity: rules.homeServiceDriverCapacity,
  });
}
