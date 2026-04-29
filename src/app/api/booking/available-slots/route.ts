import { type NextRequest, NextResponse } from "next/server";
import { getAvailableSlotsSchema } from "@/lib/validations/booking";
import { getAvailableSlots } from "@/lib/engine/availability";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const raw = {
    branchId:  searchParams.get("branchId")  ?? undefined,
    serviceId: searchParams.get("serviceId") ?? undefined,
    staffId:   searchParams.get("staffId")   ?? undefined,
    date:      searchParams.get("date")      ?? undefined,
  };

  // Validate
  const parsed = getAvailableSlotsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Returns ALL slots (available + unavailable) — client handles rendering
    const slots = await getAvailableSlots(parsed.data);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("[available-slots] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}
