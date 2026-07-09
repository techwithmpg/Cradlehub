import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { calculateHomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import { createClient } from "@/lib/supabase/server";

const distanceRequestSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  bookingType: z.literal("home_service"),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = distanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid distance request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!isDevAuthBypassEnabled()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in and try again." }, { status: 401 });
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("branch_id, system_role")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const role = canonicalizeSystemRole(staff?.system_role ?? "");
    if (!staff || !canAccessCrmWorkspace(role)) {
      return NextResponse.json(
        { error: "You do not have permission to calculate home-service distance." },
        { status: 403 }
      );
    }

    if (role !== "owner" && staff.branch_id !== parsed.data.branchId) {
      return NextResponse.json(
        { error: "You can only calculate distance for your assigned branch." },
        { status: 403 }
      );
    }
  }

  const result = await calculateHomeServiceDistanceQuote({
    branchId: parsed.data.branchId,
    destination: parsed.data.destination,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }

  return NextResponse.json(result.quote);
}
