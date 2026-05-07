import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  branchId:      z.string().uuid(),
  customerName:  z.string().min(2).max(100),
  customerPhone: z.string().min(7).max(20),
  customerEmail: z.string().email().optional().or(z.literal("")),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredTime: z.string().optional(),
  serviceId:     z.string().uuid().optional(),
  visitType:     z.enum(["in_spa", "home_service"]).optional(),
  notes:         z.string().max(500).optional(),
});

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

  return NextResponse.json({ ok: true, requestId: data.id }, { status: 201 });
}
