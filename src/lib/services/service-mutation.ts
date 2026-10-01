import { revalidatePath } from "next/cache";
import { cacheTags, invalidateCrmWorkspace, invalidateManagerWorkspace, invalidateTag } from "@/lib/cache/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];
type ServiceClient = Awaited<ReturnType<typeof createClient>>;

export function parseServicePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const price = Number(text);
  return Number.isSafeInteger(Math.round(price * 100)) ? price : null;
}

export type ServicePresentationUpdate = {
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  badges?: string[];
  inclusions?: string[];
};

export async function invalidateServiceSurfaces(serviceId?: string) {
  invalidateTag(cacheTags.serviceCatalog);
  for (const path of [
    "/", "/services", "/book", "/marketing", "/owner/marketing",
    "/owner/services", "/owner/branches", "/manager/services",
    "/crm/services", "/crm/setup", "/crm/staff", "/crm/today",
  ]) revalidatePath(path);

  if (!serviceId) return;
  const { data } = await createAdminClient()
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

export async function writeCanonicalService(
  supabase: ServiceClient,
  serviceId: string,
  update: ServiceUpdate,
  presentation?: ServicePresentationUpdate
): Promise<{ success: boolean; error?: string }> {
  const payload: ServiceUpdate = { ...update };
  if (presentation || update.price !== undefined) {
    const { data: existing, error } = await supabase
      .from("services")
      .select("metadata")
      .eq("id", serviceId)
      .single();
    if (error || !existing) {
      return { success: false, error: error?.message ?? "Service not found." };
    }
    const metadata: Record<string, Json> =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, Json>) }
        : {};
    if (update.price !== undefined) delete metadata.price_label;
    if (presentation?.shortDescription !== undefined)
      metadata.public_short_description = presentation.shortDescription;
    if (presentation?.badges !== undefined) metadata.service_badges = presentation.badges;
    if (presentation?.inclusions !== undefined) metadata.inclusions = presentation.inclusions;
    payload.metadata = metadata as Json;
    if (presentation?.description !== undefined) payload.description = presentation.description;
    if (presentation?.imageUrl !== undefined) payload.image_url = presentation.imageUrl;
    if (presentation?.imageAlt !== undefined) payload.image_alt = presentation.imageAlt;
  }

  const { data, error } = await supabase
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Service not found." };
  await invalidateServiceSurfaces(serviceId);
  return { success: true };
}
