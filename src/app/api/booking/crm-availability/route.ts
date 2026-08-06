import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getAvailableSlotsMulti } from "@/lib/engine/availability";
import { resolveExactCrmBookingTime } from "@/lib/engine/exact-crm-booking-time";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import { createClient } from "@/lib/supabase/server";

const crmAvailabilitySchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  serviceIds: z.array(z.guid("Invalid service ID")).min(1).max(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  staffId: z.guid("Invalid staff ID").optional(),
  bookingMode: z.enum(["walkin", "phone", "home_service", "standard_future"]),
  deliveryType: z.enum(["in_spa", "home_service"]),
  includeDebug: z.boolean().optional(),
});

async function assertCrmAccess(branchId: string) {
  if (isDevAuthBypassEnabled()) return { ok: true as const, role: "owner" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Please sign in and try again." };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = canonicalizeSystemRole(staff?.system_role ?? "");
  if (!staff || !canAccessCrmWorkspace(role)) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have permission to check CRM availability.",
    };
  }

  if (role !== "owner" && staff.branch_id !== branchId) {
    return {
      ok: false as const,
      status: 403,
      error: "You can only check availability for your assigned branch.",
    };
  }

  return { ok: true as const, role };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = crmAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid availability request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const access = await assertCrmAccess(parsed.data.branchId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsedTime = parseBookingTime(parsed.data.time);
  if (!parsedTime.ok) {
    return NextResponse.json(
      { error: parsedTime.error, reasonCode: "invalid_time" },
      { status: 400 }
    );
  }

  try {
    const serviceEligibility = await validateBranchServiceEligibility({
      branchId: parsed.data.branchId,
      serviceIds: parsed.data.serviceIds,
      audience: "crm",
      deliveryMode: parsed.data.deliveryType,
      useAdminClient: true,
    });

    if (!serviceEligibility.ok) {
      return NextResponse.json(
        {
          error:
            "One or more selected services are not available for this booking type at this branch.",
          reasonCode: "service_ineligible",
        },
        { status: 400 }
      );
    }

    const canSeeDebug =
      process.env.NODE_ENV !== "production" ||
      ["owner", "manager", "assistant_manager", "store_manager"].includes(access.role);
    const [exactAvailability, slots] = await Promise.all([
      resolveExactCrmBookingTime({
        branchId: parsed.data.branchId,
        serviceIds: parsed.data.serviceIds,
        date: parsed.data.date,
        startTime: parsedTime.value.canonicalTime,
        staffId: parsed.data.staffId,
        bookingMode: parsed.data.bookingMode,
        deliveryType: parsed.data.deliveryType,
        includeDebug: Boolean(parsed.data.includeDebug && canSeeDebug),
      }),
      getAvailableSlotsMulti({
        branchId: parsed.data.branchId,
        serviceIds: parsed.data.serviceIds,
        date: parsed.data.date,
        deliveryMode: parsed.data.deliveryType,
        requireStaffServiceAssignment: parsed.data.deliveryType === "home_service",
        allowStaffTypeFallbackAlongsideAssignments: parsed.data.deliveryType !== "home_service",
      }),
    ]);

    return NextResponse.json({
      ...exactAvailability,
      slots,
    });
  } catch (error) {
    console.error("[CRM_AVAILABILITY] exact-time resolution failed", error);
    return NextResponse.json({ error: "Could not load exact CRM availability." }, { status: 500 });
  }
}
