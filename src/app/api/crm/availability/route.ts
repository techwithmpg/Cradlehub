import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api/get-api-context";
import { getCrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;

  try {
    const snapshot = await getCrmAvailabilitySnapshot({
      branchId: ctx.branchId,
      date,
    });

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[api/crm/availability]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
