"use server";

import { createClient } from "@/lib/supabase/server";
import { getMarketingAccessContext } from "@/lib/queries/marketing-content";
import { updateCanonicalService } from "@/lib/services/service-mutation";

export interface UpdateServicePresentationParams {
  serviceId: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  badges?: string[];
  inclusions?: string[];
}

export async function updateServicePresentationDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: UpdateServicePresentationParams
): Promise<{ success: boolean; error?: string }> {
  return updateCanonicalService(supabase, params);
}

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

  let context;
  try {
    context = await getMarketingAccessContext();
  } catch {
    return { success: false, error: "Could not verify access. Please try again." };
  }
  if (!context) return { success: false, error: "Unauthorized" };

  if (context.role !== "owner") {
    return {
      success: false,
      error:
        "Only owners can publish live service presentation updates. Marketers should save as draft for review.",
    };
  }

  const result = await updateServicePresentationDirect(context.supabase, {
    serviceId,
    description,
    shortDescription,
    imageUrl,
    imageAlt,
    badges,
    inclusions,
  }).catch(() => ({ success: false, error: "Service save failed. Please try again." }));

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Service public presentation updated live." };
}
