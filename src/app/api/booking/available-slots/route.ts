import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlotsSchema } from "@/lib/validations/booking";
import { getAvailableSlots, getAvailableSlotsMulti } from "@/lib/engine/availability";

const uuid = z.guid("Invalid ID");
const anyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const multiSlotsSchema = z.object({
  branchId:   uuid,
  serviceIds: z.array(uuid).min(1).max(5),
  date:       anyDate,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceIdsParam = searchParams.get("serviceIds");

  // ── Multi-service path ──────────────────────────────────────────────────────
  if (serviceIdsParam) {
    const raw = {
      branchId:   searchParams.get("branchId") ?? undefined,
      serviceIds: serviceIdsParam.split(",").filter(Boolean),
      date:       searchParams.get("date") ?? undefined,
    };

    const parsed = multiSlotsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const slots = await getAvailableSlotsMulti(parsed.data);
      return NextResponse.json({ slots });
    } catch (error) {
      console.error("[available-slots/multi] Error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch available slots";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Single-service path (backward-compatible) ───────────────────────────────
  const raw = {
    branchId:  searchParams.get("branchId")  ?? undefined,
    serviceId: searchParams.get("serviceId") ?? undefined,
    staffId:   searchParams.get("staffId")   ?? undefined,
    date:      searchParams.get("date")      ?? undefined,
  };

  const parsed = getAvailableSlotsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const slots = await getAvailableSlots(parsed.data);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("[available-slots] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch available slots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
