"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DiscountQuoteSchema,
  DiscountSelectionsSchema,
  DiscountReceiptSchema,
  type DiscountQuote,
  type DiscountSelection,
} from "./discount-contract";
import { z } from "zod";

export async function quoteOrderDiscountAction(
  orderId: string,
  selections: DiscountSelection[]
): Promise<{ ok: true; data: DiscountQuote } | { ok: false; error: string }> {
  // Separate release gate: never enable an unapplied/unverified contract in production preview.
  if (process.env.CRADLEHUB_DISCOUNTS_ENABLED !== "true")
    return {
      ok: false,
      error: "Discount checkout is awaiting backend release. No discount has been applied.",
    };
  const input = z
    .object({ orderId: z.guid(), selections: DiscountSelectionsSchema })
    .safeParse({ orderId, selections });
  if (!input.success) return { ok: false, error: "Choose a valid service recipient and discount." };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to calculate a discount." };
  const { data, error } = await client.rpc(
    "quote_order_discounts" as never,
    {
      p_order_id: input.data.orderId,
      p_selections: input.data.selections,
    } as never
  );
  if (error) return { ok: false, error: error.message };
  const quote = DiscountQuoteSchema.safeParse(data);
  return quote.success
    ? { ok: true, data: quote.data }
    : { ok: false, error: "The server returned an unverified discount quote." };
}

export async function getCustomerDiscountHistoryAction(
  customerId: string
): Promise<{
  available: boolean;
  entries: Array<{ category: string; amount: number; appliedAt: string; transactionId: string }>;
}> {
  if (process.env.CRADLEHUB_DISCOUNTS_ENABLED !== "true" || !z.guid().safeParse(customerId).success)
    return { available: false, entries: [] };
  const client = await createClient();
  const { data, error } = await client.rpc(
    "customer_discount_history" as never,
    { p_customer_id: customerId } as never
  );
  const rows = z
    .array(
      z.object({
        category: z.enum(["senior", "pwd", "vip"]),
        amount: z.coerce.number().nonnegative(),
        appliedAt: z.string(),
        transactionId: z.guid(),
      })
    )
    .safeParse(data);
  return !error && rows.success
    ? { available: true, entries: rows.data }
    : { available: false, entries: [] };
}

export async function getCommittedDiscountReceiptAction(idempotencyKey: string) {
  if (process.env.CRADLEHUB_DISCOUNTS_ENABLED !== "true") return null;
  const client = await createClient();
  const { data, error } = await client.rpc(
    "discount_payment_receipt" as never,
    { p_idempotency_key: idempotencyKey } as never
  );
  const result = z
    .object({
      transaction_id: z.guid(),
      total_payable: z.coerce.number().nonnegative(),
      remaining_balance: z.coerce.number().nonnegative(),
      total_paid: z.coerce.number().nonnegative(),
      discount_receipt: DiscountReceiptSchema,
    })
    .safeParse(data);
  return !error && result.success ? result.data : null;
}
