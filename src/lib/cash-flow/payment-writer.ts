import 'server-only';

import {
  PostOrderPaymentPayloadSchema,
  type PostOrderPaymentPayload,
  type PostOrderPaymentResult,
} from './financial-contract';

export type RecordOrderPaymentResult =
  | { ok: true; data: PostOrderPaymentResult }
  | { ok: false; error: string; code?: string };

interface SupabaseRpcClient {
  rpc: (
    fn: 'post_order_payment_atomic',
    args: {
      p_order_id: string;
      p_idempotency_key: string;
      p_payments: Array<{
        amount: number;
        payment_method: string;
        financial_account_id: string;
        external_reference: string | null;
      }>;
      p_allocations: Array<{
        payable_item_id: string;
        amount: number;
      }> | null;
      p_business_date: string | null;
      p_external_reference: string | null;
      p_notes: string | null;
    }
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}

/**
 * Server-authoritative adapter for posting customer order payments atomically.
 * Validates payload schema, marshals payment tenders and allocation parts,
 * and calls public.post_order_payment_atomic RPC.
 */
export async function recordOrderPayment(
  client: unknown,
  payload: PostOrderPaymentPayload
): Promise<RecordOrderPaymentResult> {
  const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: `VALIDATION_FAILED: ${errorMsg}` };
  }

  const data = parsed.data;

  const paymentsJson = data.payments.map((p) => ({
    amount: p.amount,
    payment_method: p.paymentMethod,
    financial_account_id: p.financialAccountId,
    external_reference: p.externalReference ?? null,
  }));

  const allocationsJson =
    data.allocations && data.allocations.length > 0
      ? data.allocations.map((a) => ({
          payable_item_id: a.payableItemId,
          amount: a.amount,
        }))
      : null;

  const { data: rpcData, error } = await (client as SupabaseRpcClient).rpc(
    'post_order_payment_atomic',
    {
      p_order_id: data.orderId,
      p_idempotency_key: data.idempotencyKey,
      p_payments: paymentsJson,
      p_allocations: allocationsJson,
      p_business_date: data.businessDate ?? null,
      p_external_reference: data.externalReference ?? null,
      p_notes: data.notes ?? null,
    }
  );

  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }

  if (!rpcData || typeof rpcData !== 'object') {
    return { ok: false, error: 'PAYMENT_RPC_NO_DATA: RPC returned empty or invalid response' };
  }

  const raw = rpcData as Record<string, unknown>;

  const result: PostOrderPaymentResult = {
    success: Boolean(raw.success),
    isIdempotentReplay: Boolean(raw.is_idempotent_replay),
    transactionId: String(raw.transaction_id),
    orderId: String(raw.order_id),
    branchId: String(raw.branch_id),
    businessDate: String(raw.business_date),
    totalPaid: Number(raw.total_paid),
    totalPayable: Number(raw.total_payable),
    netAllocated: Number(raw.net_allocated),
    remainingBalance: Number(raw.remaining_balance),
    paymentState: raw.payment_state as PostOrderPaymentResult['paymentState'],
    movements: Array.isArray(raw.movements)
      ? raw.movements.map((m: Record<string, unknown>) => ({
          id: String(m.id),
          financialAccountId: String(m.financial_account_id),
          amount: Number(m.amount),
          paymentMethod: m.payment_method as PostOrderPaymentResult['movements'][number]['paymentMethod'],
          externalReference: m.external_reference ? String(m.external_reference) : null,
        }))
      : [],
    allocations: Array.isArray(raw.allocations)
      ? raw.allocations.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          financialAccountMovementId: String(a.financial_account_movement_id),
          payableItemId: a.payable_item_id ? String(a.payable_item_id) : null,
          amount: Number(a.amount),
        }))
      : [],
  };

  return { ok: true, data: result };
}
