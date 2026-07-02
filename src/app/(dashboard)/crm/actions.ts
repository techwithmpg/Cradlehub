"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validations/customer";
import {
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  getRepeatCustomers,
  getLapsedCustomers,
} from "@/lib/queries/customers";
import { getBookingsByCustomer } from "@/lib/queries/bookings";
import { revalidatePath } from "next/cache";
import { cacheTags, invalidateTag } from "@/lib/cache/cache-tags";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

// ── Auth: CRM/Front-desk + owner only ─────────────────────────────────────
async function requireCrmAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { supabase, branchId: null as string | null };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role)) return null;

  return {
    supabase,
    branchId: role === "owner" ? null : me.branch_id,
  };
}

// ── Customer list (paginated) ──────────────────────────────────────────────
export async function getCustomerListAction(page = 1) {
  const ctx = await requireCrmAccess();
  if (!ctx) return { error: "Unauthorized" };
  return getAllCustomers(page, 20, ctx.branchId);
}

// ── Search by name or phone ───────────────────────────────────────────────
export async function searchCustomersAction(query: string) {
  const ctx = await requireCrmAccess();
  if (!ctx) return { error: "Unauthorized" };
  return searchCustomers(query, ctx.branchId);
}

// ── Full customer profile + booking history ────────────────────────────────
export async function getCustomerProfileAction(customerId: string) {
  const ctx = await requireCrmAccess();
  if (!ctx) return { error: "Unauthorized" };

  const [customer, bookings] = await Promise.all([
    getCustomerById(customerId),
    getBookingsByCustomer(customerId),
  ]);
  return { customer, bookings };
}

// ── Update customer (Rule 12: notes + preferred_staff_id ONLY) ─────────────
// CRM cannot change bookings, status, or staff records.
export async function updateCustomerAction(rawInput: unknown) {
  const parsed = updateCustomerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const ctx = await requireCrmAccess();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { customerId, ...updates } = parsed.data;

  const { data: updatedRows, error } = await ctx.supabase
    .from("customers")
    .update({
      ...(updates.fullName            !== undefined && { full_name:             updates.fullName }),
      ...(updates.phone               !== undefined && { phone:                 updates.phone }),
      ...(updates.email               !== undefined && { email:                 updates.email || null }),
      ...(updates.notes               !== undefined && { notes:                 updates.notes }),
      ...(updates.preferredStaffId    !== undefined && { preferred_staff_id:    updates.preferredStaffId }),
      ...(updates.preferredVisitType  !== undefined && { preferred_visit_type:  updates.preferredVisitType }),
      ...(updates.pressurePreference  !== undefined && { pressure_preference:   updates.pressurePreference }),
      ...(updates.healthNotes         !== undefined && { health_notes:          updates.healthNotes }),
      ...(updates.birthday            !== undefined && { birthday:              updates.birthday }),
      ...(updates.loyaltyTier         !== undefined && { loyalty_tier:          updates.loyaltyTier }),
    })
    .eq("id", customerId)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: "Customer record could not be updated. You may not have permission to edit this customer, or the record no longer exists.",
    };
  }
  revalidatePath("/crm/customers");
  revalidatePath(`/crm/${customerId}`);
  if (ctx.branchId) invalidateTag(cacheTags.crmWorkspace(ctx.branchId));
  return { success: true };
}

// ── Create customer (front desk quick-add) ────────────────────────────────
export async function createCustomerAction(rawInput: unknown) {
  const parsed = createCustomerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const ctx = await requireCrmAccess();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const admin = createAdminClient();
  const { fullName, phone, email, notes } = parsed.data;
  const cleanPhone = phone.replace(/\s/g, "");

  const { data: customerId, error: rpcError } = await admin.rpc("upsert_customer", {
    p_phone: cleanPhone,
    p_full_name: fullName,
    p_email: email || undefined,
  });

  if (rpcError || !customerId) {
    return {
      success: false,
      error: rpcError?.message ?? "Could not create customer",
    };
  }

  if (notes) {
    const { error: notesError } = await admin
      .from("customers")
      .update({ notes })
      .eq("id", String(customerId));
    if (notesError) {
      return { success: false, error: notesError.message };
    }
  }

  revalidatePath("/crm/customers");
  revalidatePath("/crm/today");
  if (ctx.branchId) invalidateTag(cacheTags.crmWorkspace(ctx.branchId));
  return { success: true, customerId: String(customerId) };
}

// ── Repeat customers (2+ bookings) ────────────────────────────────────────
export async function getRepeatCustomersAction(page = 1) {
  const ctx = await requireCrmAccess();
  if (!ctx) return { error: "Unauthorized" };
  return getRepeatCustomers(2, page, 20, ctx.branchId);
}

// ── Lapsed customers (no visit in 30+ days) ───────────────────────────────
export async function getLapsedCustomersAction() {
  const ctx = await requireCrmAccess();
  if (!ctx) return { error: "Unauthorized" };
  return getLapsedCustomers(30, 50, ctx.branchId);
}
