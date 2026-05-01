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
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({ serviceId: uuid, isActive: z.boolean().optional() });
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
