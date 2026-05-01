"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createServiceCategorySchema,
  createServiceSchema,
  updateServiceSchema,
  toggleServiceSchema,
  deleteServiceSchema,
  setBranchServiceSchema,
} from "@/lib/validations/service";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff").select("system_role").eq("auth_user_id", user.id).single();
  if (me?.system_role !== "owner") return null;
  return supabase;
}

export async function createServiceCategoryAction(rawInput: unknown) {
  const parsed = createServiceCategorySchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };
  const { error } = await supabase.from("service_categories").insert({
    name: parsed.data.name,
    display_order: parsed.data.displayOrder,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/services");
  return { success: true };
}

export async function createServiceAction(rawInput: unknown) {
  const parsed = createServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };
  const d = parsed.data;
  const { data, error } = await supabase
    .from("services")
    .insert({
      category_id:      d.categoryId,
      name:             d.name,
      description:      d.description ?? null,
      duration_minutes: d.durationMinutes,
      price:            d.price,
      buffer_before:    d.bufferBefore,
      buffer_after:     d.bufferAfter,
      is_active:        d.isActive,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/services");
  return { success: true, serviceId: data.id };
}

export async function updateServiceAction(rawInput: unknown) {
  const parsed = updateServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };
  const { serviceId, ...updates } = parsed.data;
  const mapped = {
    ...(updates.categoryId      !== undefined && { category_id:      updates.categoryId }),
    ...(updates.name            !== undefined && { name:             updates.name }),
    ...(updates.description     !== undefined && { description:      updates.description }),
    ...(updates.durationMinutes !== undefined && { duration_minutes: updates.durationMinutes }),
    ...(updates.price           !== undefined && { price:            updates.price }),
    ...(updates.bufferBefore    !== undefined && { buffer_before:    updates.bufferBefore }),
    ...(updates.bufferAfter     !== undefined && { buffer_after:     updates.bufferAfter }),
    ...(updates.isActive        !== undefined && { is_active:        updates.isActive }),
  };
  const { error } = await supabase.from("services").update(mapped).eq("id", serviceId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/services");
  return { success: true };
}

export async function toggleServiceActiveAction(rawInput: unknown) {
  const parsed = toggleServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, message: "Unauthorized" };
  const { error } = await supabase
    .from("services")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.serviceId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/owner/services");
  return { ok: true };
}

export async function deleteServiceAction(rawInput: unknown) {
  const parsed = deleteServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, message: "Unauthorized" };
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", parsed.data.serviceId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/owner/services");
  return { ok: true };
}

export async function setBranchServiceAction(rawInput: unknown) {
  const parsed = setBranchServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };
  const d = parsed.data;
  const { error } = await supabase
    .from("branch_services")
    .upsert(
      {
        branch_id:    d.branchId,
        service_id:   d.serviceId,
        custom_price: d.customPrice ?? null,
        is_active:    d.isActive,
      },
      { onConflict: "branch_id,service_id" }
    );
  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/services");
  return { success: true };
}
