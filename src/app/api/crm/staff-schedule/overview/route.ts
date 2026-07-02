import { NextRequest, NextResponse } from "next/server";
import { getCrmApiContext } from "@/lib/api/get-api-context";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { getScheduleSetupOverview } from "@/lib/queries/staff-schedule-groups";

export async function GET(request: NextRequest) {
  void request.url;
  const auth = await getCrmApiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const ctx = auth.context;

  try {
    const [items, overview] = await Promise.all([
      getStaffWithAvailability(ctx.branchId),
      getScheduleSetupOverview(ctx.branchId),
    ]);

    return NextResponse.json(
      {
        items,
        groups: overview.groups,
        rulesByGroup: overview.rulesByGroup,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[api/crm/staff-schedule/overview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
