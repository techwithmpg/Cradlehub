import { NextRequest, NextResponse } from "next/server";
import { getCrmApiContext } from "@/lib/api/get-api-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getCrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

export async function GET(req: NextRequest) {
  const auth = await getCrmApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const ctx = auth.context;

  const { searchParams } = req.nextUrl;
  const today = getBranchBusinessDate();
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
