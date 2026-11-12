"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { resolveNotificationsForEntity } from "@/lib/notifications/create";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";

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

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role) || (!me.branch_id && role !== "owner")) return null;
  const ownerBranch = role === "owner"
    ? await resolveOwnerFrontDeskBranch(user.id, me.branch_id)
    : null;
  if (role === "owner" && !ownerBranch) return null;
  return { supabase, staffId: me.id as string, branchId: ownerBranch?.id ?? me.branch_id! };
}

export async function getWaitlistAction(branchId: string, status?: string) {
  const ctx = await requireCrm();
  if (!ctx) return { ok: false as const, error: "Unauthorized", data: [] };

  const requestedBranchId = branchId || ctx.branchId;
  if (requestedBranchId !== ctx.branchId && ctx.branchId !== "dev") {
    return { ok: false as const, error: "Unauthorized", data: [] };
  }

  let q = ctx.supabase
    .from("waitlist_requests")
    .select("*, services ( name )")
    .eq("branch_id", requestedBranchId)
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

  const { data: updatedRows, error } = await ctx.supabase
    .from("waitlist_requests")
    .update({
      status:                   d.status,
      contacted_by:             d.status === "contacted" || d.status === "converted" ? ctx.staffId : undefined,
      contacted_at:             d.status === "contacted" || d.status === "converted" ? now : undefined,
      converted_to_booking_id:  d.convertedToBookingId ?? undefined,
      updated_at:               now,
    })
    .eq("id", d.requestId)
    .eq("branch_id", ctx.branchId)
    .select("id");

  if (error) return { ok: false as const, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      ok: false as const,
      error: "Waitlist request could not be updated. It may belong to a different branch or no longer exist.",
    };
  }

  if (d.status !== "waiting") {
    await resolveNotificationsForEntity("waitlist_request", d.requestId, "crm");
  }

  revalidatePath("/crm/waitlist");
  revalidatePath("/crm/bookings");
  return { ok: true as const };
}

export type MatchingWaitlistCandidate = {
  id: string;
  customer_name: string;
  customer_phone: string;
  preferred_date: string | null;
  preferred_time: string | null;
  service_id: string | null;
  service_name: string | null;
  visit_type: string | null;
  status: string;
};

export async function findMatchingWaitlistForSlotAction(input: {
  bookingDate: string;
  serviceId?: string | null;
}): Promise<{ ok: boolean; candidates: MatchingWaitlistCandidate[] }> {
  const ctx = await requireCrm();
  if (!ctx) return { ok: false, candidates: [] };

  const { data, error } = await ctx.supabase
    .from("waitlist_requests")
    .select("id, customer_name, customer_phone, preferred_date, preferred_time, service_id, visit_type, status, services(name)")
    .eq("branch_id", ctx.branchId)
    .in("status", ["waiting", "contacted"])
    .or(`preferred_date.eq.${input.bookingDate},preferred_date.is.null`)
    .order("created_at", { ascending: true })
    .limit(6);

  if (error || !data) return { ok: false, candidates: [] };

  const candidates: MatchingWaitlistCandidate[] = data.map((row) => {
    const svc = Array.isArray(row.services) ? row.services[0] : row.services;
    return {
      id: row.id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      preferred_date: row.preferred_date,
      preferred_time: row.preferred_time,
      service_id: row.service_id,
      service_name: svc?.name ?? null,
      visit_type: row.visit_type,
      status: row.status,
    };
  });

  // Prioritize exact service matches first, then FIFO creation order
  candidates.sort((a, b) => {
    const aMatch = input.serviceId && a.service_id === input.serviceId ? 0 : 1;
    const bMatch = input.serviceId && b.service_id === input.serviceId ? 0 : 1;
    return aMatch - bMatch;
  });

  return { ok: true, candidates: candidates.slice(0, 3) };
}

export async function convertWaitlistToBookingSlotAction(input: {
  waitlistId: string;
  date: string;
  startTime: string;
  serviceId: string;
  staffId?: string | null;
  resourceId?: string | null;
}): Promise<{ ok: boolean; bookingId?: string; message: string }> {
  const ctx = await requireCrm();
  if (!ctx) return { ok: false, message: "Unauthorized" };

  const { data: wl } = await ctx.supabase
    .from("waitlist_requests")
    .select("id, customer_name, customer_phone, customer_email, service_id, visit_type, notes")
    .eq("id", input.waitlistId)
    .eq("branch_id", ctx.branchId)
    .maybeSingle();

  if (!wl) {
    return { ok: false, message: "Waitlist request not found." };
  }

  const effectiveServiceId = wl.service_id ?? input.serviceId;
  if (!effectiveServiceId) {
    return { ok: false, message: "Select a service to book this waitlist guest." };
  }

  const { createInhouseBookingMultiAction } = await import("@/lib/actions/inhouse-booking");
  const bookingRes = await createInhouseBookingMultiAction({
    branchId: ctx.branchId,
    fullName: wl.customer_name,
    phone: wl.customer_phone,
    email: wl.customer_email ?? undefined,
    serviceIds: [effectiveServiceId],
    date: input.date,
    startTime: input.startTime.slice(0, 5),
    type: wl.visit_type === "home_service" ? "home_service" : "walkin",
    deliveryType: wl.visit_type === "home_service" ? "home_service" : "in_spa",
    crmBookingMode: "walkin",
    staffId: input.staffId ?? undefined,
    resourceId: input.resourceId ?? undefined,
    notes: wl.notes ? `[Waitlist Auto-Fill] ${wl.notes}` : "[Waitlist Auto-Fill]",
    paymentReceived: false,
  });

  if (!bookingRes.ok) {
    return { ok: false, message: bookingRes.message };
  }

  await updateWaitlistStatusAction({
    requestId: wl.id,
    status: "converted",
    convertedToBookingId: bookingRes.bookingId,
  });

  revalidatePath("/crm/today");
  revalidatePath("/crm/bookings");
  revalidatePath("/crm/waitlist");

  return {
    ok: true,
    bookingId: bookingRes.bookingId,
    message: `Booked ${wl.customer_name} into ${input.startTime.slice(0, 5)} slot and marked waitlist converted!`,
  };
}
