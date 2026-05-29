"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { isSuperAdmin, resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { createBranchSchema, updateBranchSchema } from "@/lib/validations/branch";
import { revalidatePath } from "next/cache";
import { cacheTags, invalidateTag } from "@/lib/cache/cache-tags";
import { logBusinessEvent } from "@/lib/logger";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Super-admin and dev bypass both get owner-level access.
  if (isSuperAdmin(user.id) || isDevAuthBypassEnabled()) {
    return supabase;
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (me?.system_role !== "owner") return null;
  return supabase;
}

// Returns supabase client if caller is owner OR is a branch-scoped manager/CRM role for the given branch.
async function requireOwnerOrBranchManager(branchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Super-admin gets owner-level access on any branch.
  if (isSuperAdmin(user.id)) return supabase;

  if (isDevAuthBypassEnabled()) return supabase;

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  if (me.system_role === "owner") return supabase;
  if (
    [
      "manager", "assistant_manager", "store_manager",
      "crm", "csr_head", "csr_staff", "csr",
    ].includes(me.system_role) &&
    me.branch_id === branchId
  ) return supabase;
  return null;
}

function isMissingBranchServiceVisibilityColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("visibility") || lower.includes("booking_visibility")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

export async function createBranchAction(rawInput: unknown) {
  const parsed = createBranchSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { data: d } = parsed;
  const { data, error } = await supabase
    .from("branches")
    .insert({
      name:                   d.name,
      address:                d.address,
      phone:                  d.phone       ?? null,
      email:                  d.email       ?? null,
      maps_embed_url:         d.mapsEmbedUrl  ?? null,
      fb_page:                d.fbPage        ?? null,
      messenger_link:         d.messengerLink ?? null,
      slot_interval_minutes:  d.slotIntervalMinutes,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  invalidateTag(cacheTags.publicBranches);
  revalidatePath("/owner/branches");
  logBusinessEvent("branch.created", { branchId: data.id });
  return { success: true, branchId: data.id };
}

export async function updateBranchAction(rawInput: unknown) {
  const parsed = updateBranchSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { branchId, ...updates } = parsed.data;
  const { error } = await supabase
    .from("branches")
    .update({
      ...(updates.name                !== undefined && { name: updates.name }),
      ...(updates.address             !== undefined && { address: updates.address }),
      ...(updates.phone               !== undefined && { phone: updates.phone }),
      ...(updates.email               !== undefined && { email: updates.email }),
      ...(updates.mapsEmbedUrl        !== undefined && { maps_embed_url: updates.mapsEmbedUrl }),
      ...(updates.fbPage              !== undefined && { fb_page: updates.fbPage }),
      ...(updates.messengerLink       !== undefined && { messenger_link: updates.messengerLink }),
      ...(updates.slotIntervalMinutes !== undefined && { slot_interval_minutes: updates.slotIntervalMinutes }),
      ...(updates.isActive            !== undefined && { is_active: updates.isActive }),
    })
    .eq("id", branchId);

  if (error) return { success: false, error: error.message };
  invalidateTag(cacheTags.publicBranches);
  revalidatePath("/owner/branches");
  logBusinessEvent("branch.updated", { branchId });
  return { success: true };
}

// ── Get branch list with live stats (owner branch overview page) ──────────
export async function getBranchesOverviewAction() {
  const supabase = await requireOwner();
  if (!supabase) return { error: "Unauthorized" };

  const { getBranchesOverview } = await import("@/lib/queries/branches");
  return getBranchesOverview();
}

// ── Get single branch with full detail (owner branch edit page) ───────────
export async function getBranchDetailAction(branchId: string) {
  const supabase = await requireOwner();
  if (!supabase) return { error: "Unauthorized" };

  const { getBranchWithFullDetail } = await import("@/lib/queries/branches");
  return getBranchWithFullDetail(branchId);
}

export async function updateBranchBookingRulesAction(rawInput: unknown) {
  const { updateBranchBookingRules } = await import(
    "@/lib/queries/branch-booking-rules"
  );
  return updateBranchBookingRules(rawInput);
}

// ── Toggle branch active/inactive (soft delete) ───────────────────────────
// Explicit named action — cleaner than passing isActive through updateBranchAction
// from the UI when all you want is to deactivate/reactivate a branch.
export async function toggleBranchActiveAction(branchId: string, isActive: boolean) {
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branches")
    .update({ is_active: isActive })
    .eq("id", branchId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.publicBranches);
  revalidatePath("/owner/branches");
  revalidatePath("/owner");
  logBusinessEvent("branch.toggled", { branchId, isActive });
  return { success: true };
}

// ── Remove a service from a branch (set is_active = false) ───────────────
// Named explicitly — cleaner than using setBranchServiceAction with isActive:false.
export async function removeBranchServiceAction(branchId: string, serviceId: string) {
  const auth = await requireOwnerOrBranchManager(branchId);
  if (!auth) return { success: false, error: "Unauthorized" };

  const { error } = await createAdminClient()
    .from("branch_services")
    .update({ is_active: false })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.branchServices(branchId));
  revalidatePath("/owner/branches");
  revalidatePath("/owner/services");
  revalidatePath("/manager/services");
  revalidatePath("/crm/services");
  logBusinessEvent("branch_service.removed", { branchId, serviceId });
  return { success: true };
}

// ── Add a service to a branch (or re-enable if previously removed) ────────
export async function addBranchServiceAction(
  branchId: string,
  serviceId: string,
  customPrice?: number
) {
  const auth = await requireOwnerOrBranchManager(branchId);
  if (!auth) return { success: false, error: "Unauthorized" };

  const { error } = await createAdminClient()
    .from("branch_services")
    .upsert(
      {
        branch_id: branchId,
        service_id: serviceId,
        custom_price: customPrice ?? null,
        is_active: true,
      },
      { onConflict: "branch_id,service_id" }
    );

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.branchServices(branchId));
  revalidatePath("/owner/branches");
  revalidatePath("/owner/services");
  revalidatePath("/manager/services");
  revalidatePath("/crm/services");
  logBusinessEvent("branch_service.added", { branchId, serviceId });
  return { success: true };
}

// ── Update per-branch service eligibility flags ───────────────────────────
export async function updateBranchServiceEligibilityAction(
  branchId: string,
  serviceId: string,
  availableInSpa: boolean,
  availableHomeService: boolean
) {
  const auth = await requireOwnerOrBranchManager(branchId);
  if (!auth) return { success: false, error: "Unauthorized" };

  // Use a plain update without .select().maybeSingle() to avoid false failures.
  // The admin client bypasses RLS so if the row exists it will be updated.
  const admin = createAdminClient();
  const { error } = await admin
    .from("branch_services")
    .update({ available_in_spa: availableInSpa, available_home_service: availableHomeService })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  // Verify the row exists to provide a clear error if nothing was actually updated.
  const { data: existing, error: checkErr } = await admin
    .from("branch_services")
    .select("id, available_home_service, available_in_spa")
    .eq("branch_id", branchId)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (checkErr) return { success: false, error: checkErr.message };
  if (!existing) {
    return {
      success: false,
      error: "No branch service row found for this service. The service may not have been added to this branch yet.",
    };
  }

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.branchServices(branchId));
  // Revalidate public routes so the booking wizard picks up the change
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/book");
  revalidatePath(`/owner/branches/${branchId}`);
  revalidatePath("/manager/services");
  revalidatePath("/crm/services");
  logBusinessEvent("branch_service.eligibility_updated", { branchId, serviceId, availableInSpa, availableHomeService });
  return { success: true };
}

// ── Update per-branch service price ───────────────────────────────────────
// Sets or clears a custom price for a service at a specific branch.
// Pass null to revert to global service price.
export async function updateBranchServicePriceAction(
  branchId: string,
  serviceId: string,
  customPrice: number | null
) {
  const auth = await requireOwner();
  if (!auth) return { success: false, error: "Unauthorized" };

  const { error } = await createAdminClient()
    .from("branch_services")
    .update({ custom_price: customPrice })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.branchServices(branchId));
  revalidatePath("/owner/branches");
  logBusinessEvent("branch_service.price_updated", { branchId, serviceId });
  return { success: true };
}

// ── Update per-branch service booking visibility ──────────────────────────
// 'public' = shown in public wizard; 'csr_only' = CRM only; 'vip' = VIP only.
// CRM and CSR operational roles may toggle visibility for their own branch
// (owner retains cross-branch access via requireOwnerOrBranchManager).
export async function updateBranchServiceVisibilityAction(
  branchId: string,
  serviceId: string,
  visibility: "public" | "csr_only" | "vip"
) {
  const auth = await requireOwnerOrBranchManager(branchId);
  if (!auth) return { success: false, error: "Unauthorized" };

  const admin = createAdminClient();
  const modern = await admin
    .from("branch_services")
    .update({ visibility })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  let error = modern.error;
  if (error && isMissingBranchServiceVisibilityColumnError(error.message)) {
    const legacy = await admin
      .from("branch_services")
      .update({ booking_visibility: visibility })
      .eq("branch_id", branchId)
      .eq("service_id", serviceId);
    error = legacy.error;
  }

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  // Visibility change affects the public booking wizard's service list.
  invalidateTag(cacheTags.branchServices(branchId));
  revalidatePath(`/owner/branches/${branchId}`);
  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  logBusinessEvent("branch_service.visibility_updated", { branchId, serviceId, visibility });
  return { success: true };
}

// ── Update per-branch service delivery mode ───────────────────────────────
// Maps a high-level delivery mode to the underlying branch_services flags.
//   'in_spa'       → available_in_spa=true,  available_home_service=false, is_active=true
//   'home_service' → available_in_spa=false, available_home_service=true,  is_active=true
//   'both'         → available_in_spa=true,  available_home_service=true,  is_active=true
//   'hidden'       → is_active=false (preserves spa/home settings)
// CRM and CSR operational roles may update for their own branch.
export async function updateBranchServiceDeliveryModeAction(
  branchId: string,
  serviceId: string,
  mode: "in_spa" | "home_service" | "both" | "hidden"
) {
  const auth = await requireOwnerOrBranchManager(branchId);
  if (!auth) return { success: false, error: "Unauthorized" };

  const updates: { is_active: boolean; available_in_spa?: boolean; available_home_service?: boolean } =
    mode === "hidden"
      ? { is_active: false }
      : {
          is_active: true,
          available_in_spa: mode === "in_spa" || mode === "both",
          available_home_service: mode === "home_service" || mode === "both",
        };

  const { error } = await createAdminClient()
    .from("branch_services")
    .update(updates)
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  invalidateTag(cacheTags.branchServices(branchId));
  // Revalidate public routes so the booking wizard picks up the change
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/book");
  revalidatePath(`/owner/branches/${branchId}`);
  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  logBusinessEvent("branch_service.delivery_mode_updated", { branchId, serviceId, mode });
  return { success: true };
}

// ── Manager: get own branch booking rules ────────────────────────────────
export async function getMyBranchBookingRulesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Super-admin: resolve a real branch and grant access.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    const { getBranchBookingRulesOrDefault } = await import("@/lib/queries/branch-booking-rules");
    const { getBranchWithFullDetail } = await import("@/lib/queries/branches");
    const [rules, detail] = await Promise.all([
      getBranchBookingRulesOrDefault(superAdmin.branch_id),
      getBranchWithFullDetail(superAdmin.branch_id),
    ]);
    return { branchId: superAdmin.branch_id, rules, services: detail.services };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || (me.system_role !== "manager" && me.system_role !== "owner")) {
    return { error: "Unauthorized" };
  }
  if (!me.branch_id) return { error: "No branch assigned" };

  const { getBranchBookingRulesOrDefault } = await import("@/lib/queries/branch-booking-rules");
  const { getBranchWithFullDetail } = await import("@/lib/queries/branches");
  const [rules, detail] = await Promise.all([
    getBranchBookingRulesOrDefault(me.branch_id),
    getBranchWithFullDetail(me.branch_id),
  ]);
  return { branchId: me.branch_id, rules, services: detail.services };
}
