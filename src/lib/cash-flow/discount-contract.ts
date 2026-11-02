import { z } from "zod";

export const DiscountSelectionSchema = z
  .object({
    bookingId: z.guid(),
    category: z.enum(["senior", "pwd", "vip"]),
    attested: z.literal(true),
  })
  .strict();
export const DiscountSelectionsSchema = z
  .array(DiscountSelectionSchema)
  .max(100)
  .refine(
    (rows) => new Set(rows.map((row) => row.bookingId)).size === rows.length,
    "Only one discount can apply to a service recipient session"
  );
export type DiscountSelection = z.infer<typeof DiscountSelectionSchema>;
const money = z.coerce.number().finite().nonnegative();
export const DiscountQuoteSchema = z.object({
  version: z.string().min(1),
  orderId: z.guid(),
  subtotal: money,
  discountAmount: money,
  totalPayable: money,
  alreadyPaid: money,
  remainingBalance: money,
  selections: DiscountSelectionsSchema,
  recipients: z.array(
    z.object({ bookingId: z.guid(), recipientName: z.string(), serviceName: z.string().nullable() })
  ),
});
export type DiscountQuote = z.infer<typeof DiscountQuoteSchema>;
export const DiscountReceiptSchema = z.object({
  items: z.array(z.object({ description: z.string(), amount: z.coerce.number().finite() })).min(1),
  subtotal: money,
  discountAmount: money,
  alreadyPaid: money,
});
export type DiscountReceipt = z.infer<typeof DiscountReceiptSchema>;
