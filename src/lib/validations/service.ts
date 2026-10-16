import { z } from "zod";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");

export const createServiceCategorySchema = z.object({
  name:         z.string().min(2).max(100),
  displayOrder: z.number().int().min(0).default(0),
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;

export const createServiceSchema = z.object({
  categoryId:      uuid,
  name:            z.string().min(2).max(100),
  description:     z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(15, "Minimum 15 minutes").max(480, "Maximum 8 hours"),
  price:           z.number().min(0, "Price cannot be negative"),
  bufferBefore:    z.number().int().min(0).max(60).default(0),
  bufferAfter:     z.number().int().min(0).max(60).default(0),
  isActive:        z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({
    serviceId: uuid,
    isActive: z.boolean().optional(),
    imageUrl: z.string().trim().max(1000).refine((value) => {
      if (!value) return true;
      if (value.startsWith("/") && !value.startsWith("//")) return true;
      try { return ["http:", "https:"].includes(new URL(value).protocol); }
      catch { return false; }
    }, "Use a local path or http(s) image URL").optional(),
    imageAlt: z.string().trim().max(220).optional(),
  });
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const toggleServiceSchema = z.object({
  serviceId: uuid,
  isActive: z.boolean(),
});
export type ToggleServiceInput = z.infer<typeof toggleServiceSchema>;

export const deleteServiceSchema = z.object({
  serviceId: uuid,
});
export type DeleteServiceInput = z.infer<typeof deleteServiceSchema>;

export const setBranchServiceSchema = z.object({
  branchId:    uuid,
  serviceId:   uuid,
  customPrice: z.number().min(0).optional(),  // null = use default price
  isActive:    z.boolean().default(true),
});
export type SetBranchServiceInput = z.infer<typeof setBranchServiceSchema>;

export const ownerServiceCatalogSchema = z.object({
  serviceId: uuid.optional(),
  categoryId: uuid,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000),
  durationMinutes: z.number().int().min(15).max(480),
  price: z.number().finite().min(0).max(9999999),
  isActive: z.boolean(),
  isPublicVisible: z.boolean(),
  durationPolicy: z.enum(["fixed", "extendable"]),
  extensionIncrementMinutes: z.number().int().positive().max(480).nullable(),
  extensionPrice: z.number().finite().min(0).max(9999999).nullable(),
  maximumDurationMinutes: z.number().int().max(1440).nullable(),
  imageAlt: z.string().trim().max(220),
  allBranches: z.boolean(),
  branchIds: z.array(uuid),
}).superRefine((value, context) => {
  if (!value.allBranches && value.branchIds.length === 0) {
    context.addIssue({ code: "custom", path: ["branchIds"], message: "Choose at least one branch." });
  }
  if (value.durationPolicy === "fixed") {
    if (value.extensionIncrementMinutes !== null || value.extensionPrice !== null || value.maximumDurationMinutes !== null) {
      context.addIssue({ code: "custom", path: ["durationPolicy"], message: "Fixed services cannot have extension settings." });
    }
    return;
  }
  if (value.extensionPrice === null || value.extensionPrice <= 0) {
    context.addIssue({
      code: "custom",
      path: ["extensionPrice"],
      message: "Extension price must be greater than ₱0.",
    });
  }
  const step = value.extensionIncrementMinutes;
  const max = value.maximumDurationMinutes;
  if (step === null || max === null || max <= value.durationMinutes || (max - value.durationMinutes) % step !== 0) {
    context.addIssue({ code: "custom", path: ["maximumDurationMinutes"], message: "Set a valid increment, price, and maximum duration aligned with the base duration." });
  }
});
export type OwnerServiceCatalogInput = z.infer<typeof ownerServiceCatalogSchema>;
