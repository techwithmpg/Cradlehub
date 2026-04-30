import { z } from "zod";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");

export const createBranchSchema = z.object({
  name:                z.string().min(2).max(100),
  address:             z.string().min(5).max(500),
  phone:               z.string().min(7).max(20).optional(),
  email:               z.string().email().optional(),
  mapsEmbedUrl:        z.string().url().optional(),
  fbPage:              z.string().url().optional(),
  messengerLink:       z.string().url().optional(),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema
  .partial()
  .extend({ branchId: uuid, isActive: z.boolean().optional() });
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ── Branch service price update ───────────────────────────────────────────
export const updateBranchServicePriceSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  serviceId: z.guid("Invalid service ID"),
  customPrice: z.number().min(0, "Price cannot be negative").nullable(),
});
export type UpdateBranchServicePriceInput = z.infer<typeof updateBranchServicePriceSchema>;

// ── Branch slot interval update ───────────────────────────────────────────
export const updateBranchSlotIntervalSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});
export type UpdateBranchSlotIntervalInput = z.infer<typeof updateBranchSlotIntervalSchema>;
