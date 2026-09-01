"use server";

import { revalidatePath } from "next/cache";
import { updateBranchAction } from "@/app/(dashboard)/owner/branches/actions";
import { getMarketingAccessContext } from "@/lib/queries/marketing-content";

export async function updateBranchPresentationAction(
  _prevState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  const branchId = formData.get("branchId")?.toString();
  if (!branchId) return { success: false, error: "Branch ID is required." };

  const name = formData.get("name")?.toString();
  const address = formData.get("address")?.toString();
  const phone = formData.get("phone")?.toString() || null;
  const email = formData.get("email")?.toString() || null;
  const fbPage = formData.get("fbPage")?.toString() || null;
  const messengerLink = formData.get("messengerLink")?.toString() || null;
  const openingHours = formData.get("openingHours")?.toString() || null;
  const mapsEmbedUrl = formData.get("mapsEmbedUrl")?.toString() || null;
  const imageUrl = formData.get("imageUrl")?.toString() || null;

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  if (context.role !== "owner") {
    return {
      success: false,
      error:
        "Only owners can publish live branch updates directly. Marketers should save as draft for review.",
    };
  }

  // Fetch existing branch row to preserve all unknown location_metadata keys
  const { data: existingBranch, error: fetchError } = await context.supabase
    .from("branches")
    .select("location_metadata")
    .eq("id", branchId)
    .single();

  if (fetchError || !existingBranch) {
    return {
      success: false,
      error: `Failed to read existing branch metadata: ${fetchError?.message || "Branch not found."}`,
    };
  }

  const existingMeta =
    existingBranch.location_metadata &&
    typeof existingBranch.location_metadata === "object" &&
    !Array.isArray(existingBranch.location_metadata)
      ? (existingBranch.location_metadata as Record<string, unknown>)
      : {};

  const mergedLocationMetadata = {
    ...existingMeta,
    image_url: imageUrl,
  };

  const result = await updateBranchAction({
    branchId,
    name,
    address,
    phone,
    email,
    fbPage,
    messengerLink,
    openingHours,
    mapsEmbedUrl,
    locationMetadata: mergedLocationMetadata,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Failed to update branch." };
  }

  revalidatePath("/marketing");
  revalidatePath("/owner/marketing");
  revalidatePath("/branches");
  revalidatePath("/contact");
  revalidatePath("/");

  return { success: true, message: "Branch public presentation updated successfully." };
}
