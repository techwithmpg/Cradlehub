"use server";

import { createClient } from "@/lib/supabase/server";
import { getMarketingAccessContext } from "@/lib/queries/marketing-content";
import { parseServicePrice, writeCanonicalService, type ServicePresentationUpdate } from "@/lib/services/service-mutation";

export interface UpdateServicePresentationParams extends ServicePresentationUpdate {
  serviceId: string;
  price?: number;
}

export async function updateServicePresentationDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: UpdateServicePresentationParams
): Promise<{ success: boolean; error?: string }> {
  const { serviceId, price, ...presentation } = params;
  if (price !== undefined && parseServicePrice(price) === null) {
    return { success: false, error: "Enter a valid PHP price with at most two decimal places." };
  }
  return writeCanonicalService(supabase, serviceId, price === undefined ? {} : { price }, presentation);
}

export async function updateServicePresentationAction(
  _prevState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  const serviceId = formData.get("serviceId")?.toString();
  if (!serviceId) return { success: false, error: "Service ID is required." };
  const price = parseServicePrice(formData.get("price"));
  if (price === null) return { success: false, error: "Enter a valid PHP price with at most two decimal places." };

  const imageUrl = formData.get("imageUrl")?.toString() || null;
  const imageAlt = formData.get("imageAlt")?.toString() || null;
  const description = formData.get("description")?.toString() || null;
  const shortDescription = formData.get("shortDescription")?.toString() || null;
  const badgesRaw = formData.get("badges")?.toString() || "[]";
  const inclusionsRaw = formData.get("inclusions")?.toString() || "[]";

  let badges: string[];
  let inclusions: string[];
  try {
    badges = JSON.parse(badgesRaw);
    inclusions = JSON.parse(inclusionsRaw);
    if (![badges, inclusions].every((items) => Array.isArray(items) && items.every((item) => typeof item === "string"))) {
      return { success: false, error: "Invalid service presentation list." };
    }
  } catch {
    return { success: false, error: "Invalid service presentation list." };
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

  const result = await updateServicePresentationDirect(context.supabase, {
    serviceId,
    price,
    description,
    shortDescription,
    imageUrl,
    imageAlt,
    badges,
    inclusions,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Service public presentation and price updated live." };
}
