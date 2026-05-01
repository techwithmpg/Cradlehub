import { z } from "zod";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");

export const updateCustomerSchema = z.object({
  customerId:       uuid,
  fullName:         z.string().min(2).max(100).optional(),
  phone:            z.string().min(7).max(20).optional(),
  email:            z.string().email().optional().or(z.literal("")),
  notes:            z.string().max(1000).optional(),
  preferredStaffId: uuid.optional().nullable(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const createCustomerSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  phone: z.string().min(7, "Phone number is required").max(20),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const searchCustomerSchema = z.object({
  query: z.string().min(1).max(100), // name or phone
});
