import "server-only";

type PaymentRpcRow = {
  id: string;
  branch_id: string;
};

type PaymentRpcError = {
  message: string;
  code?: string;
};

type PaymentRpcClient = {
  rpc: (
    fn: "record_booking_payment_change",
    args: Record<string, unknown>
  ) => Promise<{ data: PaymentRpcRow[] | null; error: PaymentRpcError | null }>;
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
};

export type BookingPaymentChangeResult =
  | { ok: true; booking: PaymentRpcRow }
  | { ok: false; error: string };

export async function recordBookingPaymentChange(
  client: unknown,
  input: BookingPaymentChangeInput
): Promise<BookingPaymentChangeResult> {
  const { data, error } = await (client as PaymentRpcClient).rpc(
    "record_booking_payment_change",
    {
      p_booking_id: input.bookingId,
      p_payment_method: input.paymentMethod,
      p_payment_status: input.paymentStatus,
      p_amount_paid: input.amountPaid,
      p_payment_reference: input.paymentReference ?? null,
      p_reason: input.reason?.trim() || null,
      p_changed_by: input.changedByStaffId ?? null,
      p_branch_id: input.branchId,
      p_next_status: input.nextStatus ?? null,
      p_clear_hold: input.clearHold ?? false,
    }
  );

  if (error) {
    if (
      error.code === "P0002" ||
      error.message.includes("booking_payment_booking_not_found")
    ) {
      return {
        ok: false,
        error:
          "Booking could not be updated. It may belong to another branch or no longer exist.",
      };
    }
    return { ok: false, error: error.message };
  }

  const booking = data?.[0] ?? null;
  if (!booking) {
    return { ok: false, error: "Booking update did not return a saved row." };
  }

  return { ok: true, booking };
}
