import { z } from "zod";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");

export const updateCustomerSchema = z.object({
  customerId:       uuid,
  fullName:         z.string().min(2).max(100).optional(),
  email:            z.string().email().optional().or(z.literal("")),
  notes:            z.string().max(1000).optional(),
  preferredStaffId: uuid.optional().nullable(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const searchCustomerSchema = z.object({
  query: z.string().min(1).max(100), // name or phone
});
