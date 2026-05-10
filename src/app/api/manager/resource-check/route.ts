import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isResourceAvailable } from "@/lib/engine/resource-availability";
import { computeEndTime } from "@/lib/engine/booking-time";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const resourceId = searchParams.get("resourceId");
  const date = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const serviceId = searchParams.get("serviceId");
  const excludeBookingId = searchParams.get("excludeBookingId") ?? undefined;

  if (!resourceId || !date || !startTime || !serviceId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // Authorization: resolve user role + branch ownership
  const { data: staff } = await supabase
    .from("staff")
    .select("system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const systemRole = staff?.system_role as string | undefined;
  const userBranchId = staff?.branch_id as string | undefined;

  // Look up resource's branch
  const { data: resource } = await supabase
    .from("branch_resources")
    .select("branch_id")
    .eq("id", resourceId)
    .maybeSingle();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const resourceBranchId = resource.branch_id as string;

  const isOwner = systemRole === "owner";
  const isManager = systemRole === "manager";
  const isAssignedToBranch = isManager && userBranchId === resourceBranchId;

  if (!isOwner && !isAssignedToBranch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const endTime = await computeEndTime(startTime, serviceId);
    const available = await isResourceAvailable({
      resourceId,
      date,
      startTime,
      endTime,
      excludeBookingId
    });

    return NextResponse.json({ available });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Check failed" }, { status: 500 });
  }
}
