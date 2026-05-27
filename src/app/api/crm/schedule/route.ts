import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api/get-api-context";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { getCrmReadiness } from "@/lib/queries/crm-readiness";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const today = new Date().toISOString().split("T")[0]!;
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
      getCrmReadiness(ctx.branchId).catch(() => null),
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
          // Allow browser to cache for 30 s; stale-while-revalidate up to 60 s
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[api/crm/schedule]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
