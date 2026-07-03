import { NextRequest, NextResponse } from "next/server";
import { getCrmApiContext } from "@/lib/api/get-api-context";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

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
    const supabase = await createClient();

    const [staffRows, stats, resourcesResult, readiness] = await Promise.all([
      getDailySchedule({ branchId: ctx.branchId, date }),
      getManagerDashboardStats(ctx.branchId, date),
      supabase
        .from("branch_resources")
        .select("*")
        .eq("branch_id", ctx.branchId)
        .eq("is_active", true)
        .order("sort_order"),
      getCrmReadinessCached(ctx.branchId).catch(() => null),
    ]);

    return NextResponse.json(
      {
        branchId: ctx.branchId,
        branchName: ctx.branchName,
        staffRows,
        branchResources: resourcesResult.data ?? [],
        stats,
        readiness,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    console.error("[api/crm/schedule]", err);
    return NextResponse.json(
      { error: "Daily schedule is temporarily unavailable." },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}
