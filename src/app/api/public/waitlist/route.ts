import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { z } from "zod";
import { logError, logBusinessEvent } from "@/lib/logger";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";

const MAX_WAITLIST_PAYLOAD_BYTES = 8_000;
const WAITLIST_COOLDOWN_MS = 5 * 60 * 1000;

const uuid = z.guid("Invalid ID");

const schema = z
  .object({
    website: z.string().max(0, "Unable to submit this request").optional(),
    branchId: uuid,
    customerName: z.string().min(2).max(100),
    customerPhone: z.string().min(7).max(20),
    customerEmail: z.string().email().optional().or(z.literal("")),
    preferredDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    preferredTime: z.string().optional(),
    serviceId: uuid.optional(),
    visitType: z.enum(["in_spa", "home_service"]).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_WAITLIST_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "Please shorten your request and try again." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_WAITLIST_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Please shorten your request and try again." },
        { status: 413 }
      );
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Please check your details and try again." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const supabase = createAdminClient();
  const normalizedPhone = normalizePhone(d.customerPhone);

  let duplicateQuery = supabase
    .from("waitlist_requests")
    .select("id")
    .eq("branch_id", d.branchId)
    .in("customer_phone", [d.customerPhone, normalizedPhone])
    .gte("created_at", new Date(Date.now() - WAITLIST_COOLDOWN_MS).toISOString());
  duplicateQuery = d.serviceId
    ? duplicateQuery.eq("service_id", d.serviceId)
    : duplicateQuery.is("service_id", null as never);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1);
  if (duplicateError) {
    logError("waitlist.public.duplicate_check_failed", {
      action: "waitlist.public.create",
      branchId: d.branchId,
      serviceId: d.serviceId ?? null,
      error: duplicateError,
    });
    return NextResponse.json(
      { error: "We could not submit your request. Please try again." },
      { status: 500 }
    );
  }
  if (duplicate?.length) {
    return NextResponse.json(
      { error: "We already received this request. Please wait a few minutes before trying again." },
      { status: 409 }
    );
  }

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
    return NextResponse.json({ error: "Please choose an active branch." }, { status: 400 });
  }

  if (d.serviceId) {
    try {
      const serviceEligibility = await validateBranchServiceEligibility({
        branchId: d.branchId,
        serviceIds: [d.serviceId],
        audience: "public",
        deliveryMode: d.visitType ?? "any",
        useAdminClient: true,
      });

      if (!serviceEligibility.ok) {
        const message =
          d.visitType === "home_service"
            ? "Selected service is not available for home service."
            : d.visitType === "in_spa"
              ? "Selected service is not available for in-spa visits."
              : "Selected service is not available for public waitlist requests.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Could not validate selected service" }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("waitlist_requests")
    .insert({
      branch_id: d.branchId,
      customer_name: d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail || null,
      preferred_date: d.preferredDate ?? null,
      preferred_time: d.preferredTime ?? null,
      service_id: d.serviceId ?? null,
      visit_type: d.visitType ?? null,
      notes: d.notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    logError("waitlist.public.insert_failed", {
      action: "waitlist.public.create",
      branchId: d.branchId,
      serviceId: d.serviceId ?? null,
      error,
    });
    return NextResponse.json(
      { error: "We could not submit your request. Please try again." },
      { status: 500 }
    );
  }

  try {
    await createNotification({
      branchId: d.branchId,
      targetWorkspace: "crm",
      type: "waitlist_request_submitted",
      title: `New waitlist request — ${d.customerName}`,
      body: d.preferredDate
        ? `${d.customerName} joined the waitlist for ${d.preferredDate}${d.preferredTime ? ` at ${d.preferredTime}` : ""}.`
        : `${d.customerName} joined the waitlist.`,
      entityType: "waitlist_request",
      entityId: data.id,
      actionHref: getNotificationTargetPath({
        workspace: "crm",
        entityType: "waitlist_request",
        entityId: data.id,
      }),
      priority: "normal",
      requiresAction: true,
      dedupeKey: `waitlist:${data.id}:submitted`,
    });
  } catch (notificationError) {
    logError("waitlist.public.notification_failed", {
      action: "waitlist.public.create",
      branchId: d.branchId,
      requestId: data.id,
      error: notificationError,
    });
  }

  logBusinessEvent("waitlist.public.submitted", {
    branchId: d.branchId,
    requestId: data.id,
    serviceId: d.serviceId ?? null,
  });

  return NextResponse.json({ ok: true, requestId: data.id }, { status: 201 });
}
