"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  createServiceCategorySchema,
  createServiceSchema,
  updateServiceSchema,
  toggleServiceSchema,
  deleteServiceSchema,
  setBranchServiceSchema,
  ownerServiceCatalogSchema,
} from "@/lib/validations/service";
import { revalidatePath } from "next/cache";
import {
  cacheTags,
  invalidateCrmWorkspace,
  invalidateManagerWorkspace,
  invalidateTag,
} from "@/lib/cache/cache-tags";
import { synchronizeBranchServiceCatalog } from "@/lib/services/service-catalog";
import { invalidateServiceSurfaces, writeCanonicalService } from "@/lib/services/service-mutation";
import { validateMediaBuffer } from "@/lib/marketing/media-contracts-server";
import { getMediaContract } from "@/lib/marketing/media-contracts";
import type { Json } from "@/types/supabase";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return supabase;
  }

  const { data: me } = await supabase
    .from("staff").select("system_role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
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

  try {
    if (d.isActive) {
      await synchronizeBranchServiceCatalog({ serviceId: data.id });
    }
  } catch (syncError) {
    return {
      success: false,
      error:
        syncError instanceof Error
          ? syncError.message
          : "Service was created, but branch mappings could not be synchronized.",
    };
  }

  await invalidateServiceSurfaces(data.id);
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
  return writeCanonicalService(supabase, serviceId, mapped, {
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
    ...(updates.imageAlt !== undefined && { imageAlt: updates.imageAlt }),
  });
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
  await invalidateServiceSurfaces(parsed.data.serviceId);
  return { ok: true };
}

export async function deleteServiceAction(rawInput: unknown) {
  const parsed = deleteServiceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, message: "Unauthorized" };
  // A service ID can be referenced by booking and financial history. The
  // legacy hard-delete action stays callable for route compatibility, but
  // destructive deletion is closed until an archival contract is reviewed.
  return { ok: false, message: "Service deletion is unavailable. Set the service inactive instead." };
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
  invalidateTag(cacheTags.branchServices(d.branchId));
  invalidateTag(cacheTags.branchAssignableServices(d.branchId));
  invalidateCrmWorkspace(d.branchId);
  invalidateManagerWorkspace(d.branchId);
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/book");
  revalidatePath("/owner/services");
  revalidatePath(`/owner/branches/${d.branchId}`);
  revalidatePath("/manager/services");
  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  revalidatePath("/crm/staff");
  return { success: true };
}

// The modal submits the file with the catalog data. Nothing is uploaded until
// Save, and a failed database write removes the newly uploaded object.
export async function saveOwnerServiceCatalogAction(formData: FormData): Promise<
  { success: true; serviceId: string } | { success: false; error: string }
> {
  const supabase = await requireOwner();
  if (!supabase) return { success: false, error: "Unauthorized" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("catalog") ?? ""));
  } catch {
    return { success: false, error: "Invalid service form data." };
  }
  const parsed = ownerServiceCatalogSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid service." };
  const data = parsed.data;

  const { data: categories, error: categoriesError } = await supabase
    .from("service_categories").select("id").eq("id", data.categoryId).eq("is_active", true).maybeSingle();
  if (categoriesError || !categories) return { success: false, error: "Choose an active category." };

  const { data: branchRows, error: branchesError } = await supabase
    .from("branches").select("id").eq("is_active", true);
  if (branchesError) return { success: false, error: branchesError.message };
  const eligibleBranches = new Set((branchRows ?? []).map((branch) => branch.id));
  if (eligibleBranches.size === 0 || (!data.allBranches && data.branchIds.some((id) => !eligibleBranches.has(id)))) {
    return { success: false, error: "Choose current active branches." };
  }

  let oldImageUrl: string | null = null;
  let oldBufferBefore = 0;
  let oldBufferAfter = 0;
  if (data.serviceId) {
    const { data: existing, error } = await supabase.from("services")
      .select("image_url, buffer_before, buffer_after")
      .eq("id", data.serviceId).maybeSingle();
    if (error || !existing) return { success: false, error: "Service not found." };
    oldImageUrl = existing.image_url;
    oldBufferBefore = existing.buffer_before;
    oldBufferAfter = existing.buffer_after;
  }

  const file = formData.get("image");
  let uploadedPath: string | null = null;
  let imageUrl = oldImageUrl;
  if (file instanceof File && file.size > 0) {
    const contract = getMediaContract("SERVICE_PHOTO");
    if (!contract.allowedMimeTypes.includes(file.type) || file.size > contract.maxBytes) {
      return { success: false, error: "Choose a JPG, PNG, or WebP service image under 5 MB." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = await validateMediaBuffer(buffer, file.type, contract);
    if (!validation.isValid) return { success: false, error: validation.error ?? "Invalid service image." };
    const extension = validation.format === "jpeg" ? "jpg" : validation.format || file.type.split("/")[1];
    uploadedPath = `service-images/${data.serviceId ?? crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("public-site-media")
      .upload(uploadedPath, buffer, { contentType: file.type, upsert: false });
    if (uploadError) return { success: false, error: uploadError.message };
    imageUrl = supabase.storage.from("public-site-media").getPublicUrl(uploadedPath).data.publicUrl;
  }

  const catalog = {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description,
    durationMinutes: data.durationMinutes,
    price: data.price,
    bufferBefore: oldBufferBefore,
    bufferAfter: oldBufferAfter,
    isActive: data.isActive,
    isPublicVisible: data.isPublicVisible,
    durationPolicy: data.durationPolicy,
    extensionIncrementMinutes: data.extensionIncrementMinutes,
    extensionPrice: data.extensionPrice,
    maximumDurationMinutes: data.maximumDurationMinutes,
    imageUrl,
    imageAlt: data.imageAlt || `${data.name} service at Cradle Wellness Living`,
  };
  const { data: serviceId, error: saveError } = await supabase.rpc("save_owner_service_catalog", {
    p_service_id: data.serviceId ?? null,
    p_catalog: catalog as Json,
    p_all_branches: data.allBranches,
    p_branch_ids: data.allBranches ? [] : data.branchIds,
  });
  if (saveError || !serviceId) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("public-site-media").remove([uploadedPath]);
      if (cleanupError) {
        console.error("Service upload cleanup failed", { path: uploadedPath, error: cleanupError.message });
        return {
          success: false,
          error: `${saveError?.message ?? "Service could not be saved."} The temporary image could not be removed; ask an administrator to check the service-images folder.`,
        };
      }
    }
    return { success: false, error: saveError?.message ?? "Service could not be saved." };
  }

  // Superseded files from this workflow are private to the service. Legacy or
  // shared Marketing assets are preserved because other content may use them.
  if (uploadedPath && oldImageUrl) {
    const oldPath = oldImageUrl.split("/storage/v1/object/public/public-site-media/")[1];
    if (oldPath?.startsWith("service-images/")) {
      const { error: cleanupError } = await supabase.storage.from("public-site-media").remove([oldPath]);
      if (cleanupError) console.error("Superseded service image cleanup failed", { path: oldPath, error: cleanupError.message });
    }
  }

  invalidateTag(cacheTags.serviceCatalog);
  for (const path of ["/", "/services", "/book", "/owner/services", "/crm/bookings/new", "/crm/services"]) {
    revalidatePath(path);
  }
  for (const branchId of eligibleBranches) {
    invalidateTag(cacheTags.branchServices(branchId));
    invalidateTag(cacheTags.branchAssignableServices(branchId));
    invalidateCrmWorkspace(branchId);
    invalidateManagerWorkspace(branchId);
    revalidatePath(`/owner/branches/${branchId}`);
  }
  return { success: true, serviceId };
}
