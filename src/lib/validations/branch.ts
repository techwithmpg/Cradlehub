import { z } from "zod";

const uuid = z.string().uuid("Invalid ID");

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
