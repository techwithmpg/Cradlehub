"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { cacheTags, invalidateTag } from "@/lib/cache/cache-tags";
import { getMarketingAccessContext } from "@/lib/queries/marketing-content";
import type { Json } from "@/types/supabase";

export async function updateServicePresentationAction(
  _prevState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  const serviceId = formData.get("serviceId")?.toString();
  if (!serviceId) return { success: false, error: "Service ID is required." };

  const imageUrl = formData.get("imageUrl")?.toString() || null;
  const imageAlt = formData.get("imageAlt")?.toString() || null;
  const description = formData.get("description")?.toString() || null;
  const shortDescription = formData.get("shortDescription")?.toString() || null;
  const badgesRaw = formData.get("badges")?.toString() || "[]";
  const inclusionsRaw = formData.get("inclusions")?.toString() || "[]";

  let badges: string[] = [];
  let inclusions: string[] = [];
  try {
    badges = JSON.parse(badgesRaw);
    inclusions = JSON.parse(inclusionsRaw);
  } catch {
    // fallback empty
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  if (context.role !== "owner") {
    return {
      success: false,
      error:
        "Only owners can publish live service presentation updates. Marketers should save as draft for review.",
    };
  }

  const supabase = await createClient();

  // Fetch existing service metadata so we preserve non-marketing metadata fields
  const { data: existingService, error: fetchError } = await supabase
    .from("services")
    .select("metadata")
    .eq("id", serviceId)
    .single();

  if (fetchError || !existingService) {
    return { success: false, error: fetchError?.message ?? "Service not found." };
  }

  const existingMeta = (
    existingService.metadata &&
    typeof existingService.metadata === "object" &&
    !Array.isArray(existingService.metadata)
      ? existingService.metadata
      : {}
  ) as Record<string, Json>;

  const updatedMetadata: Record<string, Json> = {
    ...existingMeta,
    public_short_description: shortDescription,
    service_badges: badges,
    inclusions: inclusions,
  };

  const { error: updateError } = await supabase
    .from("services")
    .update({
      image_url: imageUrl,
      image_alt: imageAlt,
      description: description,
      metadata: updatedMetadata as unknown as Json,
    })
    .eq("id", serviceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  invalidateTag(cacheTags.serviceCatalog);
  revalidatePath("/marketing");
  revalidatePath("/owner/marketing");
  revalidatePath("/services");
  revalidatePath("/book");
  revalidatePath("/");

  return { success: true, message: "Service public presentation updated live." };
}
