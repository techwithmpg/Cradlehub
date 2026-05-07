"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ALLOWED_ROLES = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

async function requireCrm() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { supabase, staffId: null as string | null, branchId: mock.branch_id as string };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role) || !me.branch_id) return null;
  return { supabase, staffId: me.id as string, branchId: me.branch_id as string };
}

export async function getWaitlistAction(branchId: string, status?: string) {
  const ctx = await requireCrm();
  if (!ctx) return { ok: false as const, error: "Unauthorized", data: [] };

  let q = ctx.supabase
    .from("waitlist_requests")
    .select("*, services ( name )")
    .eq("branch_id", branchId)
    .order("preferred_date", { ascending: true, nullsFirst: false })
    .order("created_at");

  if (status) q = q.eq("status", status);

  const { data, error } = await q.limit(100);
  if (error) return { ok: false as const, error: error.message, data: [] };
  return { ok: true as const, data: data ?? [] };
}

const updateStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["waiting", "contacted", "converted", "expired", "cancelled"]),
  convertedToBookingId: z.string().uuid().optional().nullable(),
});

export async function updateWaitlistStatusAction(rawInput: unknown) {
  const ctx = await requireCrm();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const parsed = updateStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const d = parsed.data;
  const now = new Date().toISOString();

  const { error } = await ctx.supabase
    .from("waitlist_requests")
    .update({
      status:                   d.status,
      contacted_by:             d.status === "contacted" || d.status === "converted" ? ctx.staffId : undefined,
      contacted_at:             d.status === "contacted" || d.status === "converted" ? now : undefined,
      converted_to_booking_id:  d.convertedToBookingId ?? undefined,
      updated_at:               now,
    })
    .eq("id", d.requestId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/crm/waitlist");
  return { ok: true as const };
}
