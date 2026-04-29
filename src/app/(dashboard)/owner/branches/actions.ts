"use server";

import { createClient } from "@/lib/supabase/server";
import { createBranchSchema, updateBranchSchema } from "@/lib/validations/branch";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
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
