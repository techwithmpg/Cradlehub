"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canManageResources } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { createBranchResourceSchema, updateBranchResourceSchema } from "@/lib/validations/branch";
import { revalidatePath } from "next/cache";

async function requireOwnerOrManager(branchId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return supabase;
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  
  if (!me) return null;
  
  const role = canonicalizeSystemRole(me.system_role);
  // Owner can manage any branch
  if (role === "owner") return supabase;

  // Branch-scoped staff (managers + CRM ops) can manage only their own branch.
  if (canManageResources(role)) {
    if (branchId && me.branch_id !== branchId) return null;
    return supabase;
  }

  return null;
}

export async function createBranchResourceAction(rawInput: unknown) {
  const parsed = createBranchResourceSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { branchId, ...data } = parsed.data;
  const supabase = await requireOwnerOrManager(branchId);
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branch_resources")
    .insert({
      branch_id: branchId,
      name: data.name,
      type: data.type,
      capacity: data.capacity,
      is_active: data.isActive,
      sort_order: data.sortOrder,
      notes: data.notes ?? null,
    });

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/branches");
  revalidatePath(`/owner/branches/${branchId}`);
  revalidatePath("/manager/operations");
  revalidatePath("/crm/spaces-rules");
  return { success: true };
}

export async function updateBranchResourceAction(rawInput: unknown) {
  const parsed = updateBranchResourceSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { resourceId, ...updates } = parsed.data;
  
  // Need to find branchId to verify permission
  const supabaseClient = await createClient();
  const { data: existing } = await supabaseClient
    .from("branch_resources")
    .select("branch_id")
    .eq("id", resourceId)
    .single();
  
  if (!existing) return { success: false, error: "Resource not found" };

  const supabase = await requireOwnerOrManager(existing.branch_id);
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branch_resources")
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.capacity !== undefined && { capacity: updates.capacity }),
      ...(updates.isActive !== undefined && { is_active: updates.isActive }),
      ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    })
    .eq("id", resourceId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/branches");
  revalidatePath(`/owner/branches/${existing.branch_id}`);
  revalidatePath("/crm/spaces-rules");
  return { success: true };
}

export async function toggleBranchResourceActiveAction(resourceId: string, isActive: boolean) {
  const supabaseClient = await createClient();
  const { data: existing } = await supabaseClient
    .from("branch_resources")
    .select("branch_id")
    .eq("id", resourceId)
    .single();
    
  if (!existing) return { success: false, error: "Resource not found" };

  const supabase = await requireOwnerOrManager(existing.branch_id);
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("branch_resources")
    .update({ is_active: isActive })
    .eq("id", resourceId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/branches");
  revalidatePath(`/owner/branches/${existing.branch_id}`);
  revalidatePath("/crm/spaces-rules");
  return { success: true };
}

export async function getBranchResourcesAction(branchId: string, onlyActive = false) {
  const supabase = await createClient(); // Use standard client for read if RLS allows
  
  let query = supabase
    .from("branch_resources")
    .select("*")
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
    
  if (onlyActive) {
    query = query.eq("is_active", true);
  }
  
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { data };
}
