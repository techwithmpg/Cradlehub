import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { z } from "zod";

const uuid = z.guid("Invalid ID");

const schema = z.object({
  branchId:      uuid,
  customerName:  z.string().min(2).max(100),
  customerPhone: z.string().min(7).max(20),
  customerEmail: z.string().email().optional().or(z.literal("")),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredTime: z.string().optional(),
  serviceId:     uuid.optional(),
  visitType:     z.enum(["in_spa", "home_service"]).optional(),
  notes:         z.string().max(500).optional(),
});

function isMissingServiceVisibilityError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("booking_visibility") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const supabase = createAdminClient();

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("id", d.branchId)
    .eq("is_active", true)
    .maybeSingle();

  if (branchError) {
    return NextResponse.json({ error: "Could not validate branch" }, { status: 500 });
  }

  if (!branch) {
    return NextResponse.json(
      { error: "Please choose an active branch." },
      { status: 400 }
    );
  }

  if (d.serviceId) {
    let serviceQuery = await supabase
      .from("branch_services")
      .select("service_id, available_in_spa, available_home_service, booking_visibility")
      .eq("branch_id", d.branchId)
      .eq("service_id", d.serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceQuery.error && isMissingServiceVisibilityError(serviceQuery.error.message)) {
      serviceQuery = await supabase
        .from("branch_services")
        .select("service_id, available_in_spa, available_home_service")
        .eq("branch_id", d.branchId)
        .eq("service_id", d.serviceId)
        .eq("is_active", true)
        .maybeSingle();
    }

    if (serviceQuery.error) {
      return NextResponse.json(
        { error: "Could not validate selected service" },
        { status: 500 }
      );
    }

    if (!serviceQuery.data) {
      return NextResponse.json(
        { error: "Selected service is not available at this branch." },
        { status: 400 }
      );
    }

    const service = serviceQuery.data as {
      available_in_spa: boolean | null;
      available_home_service: boolean | null;
      booking_visibility?: string | null;
    };

    if (service.booking_visibility && service.booking_visibility !== "public") {
      return NextResponse.json(
        { error: "Selected service is not available for public waitlist requests." },
        { status: 400 }
      );
    }

    if (d.visitType === "home_service" && service.available_home_service === false) {
      return NextResponse.json(
        { error: "Selected service is not available for home service." },
        { status: 400 }
      );
    }

    if (d.visitType === "in_spa" && service.available_in_spa === false) {
      return NextResponse.json(
        { error: "Selected service is not available for in-spa visits." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("waitlist_requests")
    .insert({
      branch_id:      d.branchId,
      customer_name:  d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail || null,
      preferred_date: d.preferredDate ?? null,
      preferred_time: d.preferredTime ?? null,
      service_id:     d.serviceId ?? null,
      visit_type:     d.visitType ?? null,
      notes:          d.notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createNotification({
    branchId: d.branchId,
    targetWorkspace: "crm",
    type: "waitlist_request_submitted",
    title: "New waitlist request",
    body: `${d.customerName} joined the waitlist.`,
    entityType: "waitlist_request",
    entityId: data.id,
    actionHref: getNotificationTargetPath({ workspace: "crm", entityType: "waitlist_request", entityId: data.id }),
    priority: "normal",
    requiresAction: true,
  });

  return NextResponse.json({ ok: true, requestId: data.id }, { status: 201 });
}
