import "server-only";

type PaymentRpcRow = {
  booking_id: string;
  branch_id: string;
  transaction_id: string | null;
  payment_delta: number;
  is_idempotent_replay: boolean;
  reconciliation_warning: string | null;
};

type PaymentRpcError = {
  message: string;
  code?: string;
};

type PaymentRpcClient = {
  rpc: (
    fn: "post_booking_payment_atomic",
    args: Record<string, unknown>
  ) => Promise<{ data: PaymentRpcRow | null; error: PaymentRpcError | null }>;
};

export type BookingTenderInput = {
  amount: number;
  paymentMethod: "cash" | "gcash" | "maya" | "bank_transfer" | "card";
  financialAccountId?: string | null;
  externalReference?: string | null;
};

export type BookingPaymentChangeInput = {
  bookingId: string;
  branchId: string | null;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number;
  paymentReference?: string | null;
  reason?: string | null;
  changedByStaffId?: string | null;
  nextStatus?: string | null;
  clearHold?: boolean;
  idempotencyKey?: string;
  payments?: BookingTenderInput[];
  financialAccountId?: string | null;
  businessDate?: string;
};

export type BookingPaymentChangeResult =
  | { ok: true; booking: { id: string; branch_id: string }; transactionId: string | null; paymentDelta: number; reconciliationWarning: string | null; isIdempotentReplay: boolean }
  | { ok: false; error: string };

export async function recordBookingPaymentChange(
  client: unknown,
  input: BookingPaymentChangeInput
): Promise<BookingPaymentChangeResult> {
  const { data, error } = await (client as PaymentRpcClient).rpc(
    "post_booking_payment_atomic",
    {
      p_booking_id: input.bookingId,
      p_payment_method: input.paymentMethod,
      p_payment_status: input.paymentStatus,
      p_amount_paid: input.amountPaid,
      p_payment_reference: input.paymentReference ?? null,
      p_reason: input.reason?.trim() || null,
      p_branch_id: input.branchId,
      p_next_status: input.nextStatus ?? null,
      p_clear_hold: input.clearHold ?? false,
      p_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
      p_payments: input.payments
        ? input.payments.map((part) => ({
            amount: part.amount,
            payment_method: part.paymentMethod,
            financial_account_id: part.financialAccountId ?? null,
            external_reference: part.externalReference ?? null,
          }))
        : null,
      p_business_date: input.businessDate ?? null,
      p_financial_account_id: input.financialAccountId ?? null,
    }
  );

  if (error) {
    if (
      error.code === "P0002" ||
      error.message.includes("BOOKING_NOT_FOUND")
    ) {
      return {
        ok: false,
        error:
          "Booking could not be updated. It may belong to another branch or no longer exist.",
      };
    }
    return { ok: false, error: error.message };
  }

  if (!data?.booking_id || !data.branch_id) {
    return { ok: false, error: "Booking update did not return a saved row." };
  }

  return {
    ok: true,
    booking: { id: data.booking_id, branch_id: data.branch_id },
    transactionId: data.transaction_id,
    paymentDelta: Number(data.payment_delta),
    reconciliationWarning: data.reconciliation_warning,
    isIdempotentReplay: data.is_idempotent_replay,
  };
}
