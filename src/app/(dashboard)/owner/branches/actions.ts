"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createBranchSchema, updateBranchSchema } from "@/lib/validations/branch";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return supabase;
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .single();
  if (me?.system_role !== "owner") return null;
  return supabase;
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
  revalidatePath("/owner/branches");
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
  revalidatePath("/owner/branches");
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
  revalidatePath("/owner/branches");
  revalidatePath("/owner");
  return { success: true };
}

// ── Remove a service from a branch (set is_active = false) ───────────────
// Named explicitly — cleaner than using setBranchServiceAction with isActive:false.
export async function removeBranchServiceAction(branchId: string, serviceId: string) {
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branch_services")
    .update({ is_active: false })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/owner/branches");
  revalidatePath("/owner/services");
  return { success: true };
}

// ── Add a service to a branch (or re-enable if previously removed) ────────
export async function addBranchServiceAction(
  branchId: string,
  serviceId: string,
  customPrice?: number
) {
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
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
  revalidatePath("/owner/branches");
  revalidatePath("/owner/services");
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
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branch_services")
    .update({ custom_price: customPrice })
    .eq("branch_id", branchId)
    .eq("service_id", serviceId);

  if (error) return { success: false, error: error.message };

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/owner/branches");
  return { success: true };
}
