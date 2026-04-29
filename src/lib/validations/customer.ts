import { z } from "zod";

// Rule 12: CRM can only annotate notes and preferred therapist.
export const updateCustomerSchema = z
  .object({
    customerId: z.string().min(1, "Customer ID is required"),
    notes: z.string().max(2000).optional(),
    preferredStaffId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.notes !== undefined || value.preferredStaffId !== undefined, {
    message: "Nothing to update",
  });
