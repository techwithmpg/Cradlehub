import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cacheTags, invalidateCrmWorkspace, invalidateManagerWorkspace, invalidateTag } from "@/lib/cache/cache-tags";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

const canonicalServiceUpdateSchema = z.object({
  serviceId: z.guid(),
  categoryId: z.guid().optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  price: z.number().min(0).optional(),
  bufferBefore: z.number().int().min(0).max(60).optional(),
  bufferAfter: z.number().int().min(0).max(60).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
  imageAlt: z.string().max(300).nullable().optional(),
  shortDescription: z.string().max(320).nullable().optional(),
  badges: z.array(z.string().max(100)).max(20).optional(),
  inclusions: z.array(z.string().max(200)).max(30).optional(),
});

export type CanonicalServiceUpdate = z.input<typeof canonicalServiceUpdateSchema>;
type ServiceClient = Awaited<ReturnType<typeof createClient>>;

export async function invalidateCanonicalServiceSurfaces(serviceId: string, supabase: ServiceClient): Promise<void> {
  invalidateTag(cacheTags.serviceCatalog);
  for (const path of [
    "/", "/services", "/book", "/marketing", "/owner/marketing",
    "/owner/services", "/owner/branches", "/manager/services", "/crm/services",
    "/crm/setup", "/crm/staff", "/crm/today",
  ]) revalidatePath(path);

  const { data } = await supabase
    .from("branch_services")
    .select("branch_id")
    .eq("service_id", serviceId);
  for (const branchId of new Set((data ?? []).map((row) => row.branch_id))) {
    invalidateTag(cacheTags.branchServices(branchId));
    invalidateTag(cacheTags.branchAssignableServices(branchId));
    invalidateCrmWorkspace(branchId);
    invalidateManagerWorkspace(branchId);
    revalidatePath(`/owner/branches/${branchId}`);
  }
}

// Callers must authorize an owner before invoking this mutation.
export async function updateCanonicalService(
  supabase: ServiceClient,
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = canonicalServiceUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid service update." };
  }

  const input = parsed.data;
  const { data: existing, error: readError } = await supabase
    .from("services")
    .select("metadata")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (readError || !existing) {
    return { success: false, error: readError?.message ?? "Service not found or unavailable." };
  }

  const payload: Database["public"]["Tables"]["services"]["Update"] = {};
  if (input.categoryId !== undefined) payload.category_id = input.categoryId;
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.durationMinutes !== undefined) payload.duration_minutes = input.durationMinutes;
  if (input.price !== undefined) payload.price = input.price;
  if (input.bufferBefore !== undefined) payload.buffer_before = input.bufferBefore;
  if (input.bufferAfter !== undefined) payload.buffer_after = input.bufferAfter;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
  if (input.imageAlt !== undefined) payload.image_alt = input.imageAlt;

  if (input.shortDescription !== undefined || input.badges !== undefined || input.inclusions !== undefined) {
    const metadata = existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? { ...existing.metadata } as Record<string, Json>
      : {};
    if (input.shortDescription !== undefined) metadata.public_short_description = input.shortDescription;
    if (input.badges !== undefined) metadata.service_badges = input.badges;
    if (input.inclusions !== undefined) metadata.inclusions = input.inclusions;
    payload.metadata = metadata;
  }

  const { data: updated, error: updateError } = await supabase
    .from("services")
    .update(payload)
    .eq("id", input.serviceId)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    return { success: false, error: updateError?.message ?? "Service update was not permitted." };
  }

  await invalidateCanonicalServiceSurfaces(input.serviceId, supabase);
  return { success: true };
}
