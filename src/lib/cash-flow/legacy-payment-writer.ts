import 'server-only';

import { z } from 'zod';
import { revalidateOperationalBookingSurfaces } from '@/lib/bookings/revalidate-booking-surfaces';
import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';
import { isBookingClosedForCrm } from '@/lib/bookings/crm-booking-status';
import { canConfirmPayments } from '@/lib/auth/crm-permissions';
import { validatedLegacyBookingPrice } from './legacy-booking-price';
import { PaymentPartPayloadSchema } from './financial-contract';

export const LegacyBookingPaymentPayloadSchema = z.object({
  bookingId: z.guid(),
  branchId: z.guid(),
  expectedAmountPaid: z.number().nonnegative().refine(
    (amount) => Number.isFinite(amount) && Number(amount.toFixed(2)) === amount
  ),
  idempotencyKey: z.string().trim().min(1).max(255),
  payments: z.array(PaymentPartPayloadSchema).min(1),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).nullish(),
});

export type LegacyBookingPaymentPayload = z.infer<typeof LegacyBookingPaymentPayloadSchema>;

export type LegacyBookingPaymentActor = {
  userId: string;
  role?: string | null;
  staffId?: string | null;
  branchId?: string | null;
};

export type LegacyBookingPaymentResult =
  | {
      ok: true;
      data: {
        transactionId: string | null;
        paymentDelta: number;
        isIdempotentReplay: boolean;
        branchId: string;
        success: boolean;
      };
    }
  | { ok: false; error: string; code?: string };

/**
 * Server-authoritative domain function for recording legacy booking payments.
 * Accepts an already-authenticated Supabase client and actor context,
 * ensuring seamless execution under both web cookie auth and desktop bearer auth.
 */
export async function recordLegacyBookingPaymentDomain(
  supabase: unknown,
  input: LegacyBookingPaymentPayload,
  actor: LegacyBookingPaymentActor
): Promise<LegacyBookingPaymentResult> {
  if (!actor?.userId) {
    return { ok: false, error: 'AUTH_REQUIRED: Authentication required to record payments.', code: 'AUTH_REQUIRED' };
  }

  if (!actor.staffId) {
    return { ok: false, error: 'STAFF_REQUIRED: Active staff profile is required to record payments.', code: 'STAFF_REQUIRED' };
  }

  if (!actor.role || typeof actor.role !== 'string' || !actor.role.trim()) {
    return { ok: false, error: 'ROLE_REQUIRED: Staff role is required and must be authorized to record payments.', code: 'ROLE_REQUIRED' };
  }

  if (!canConfirmPayments(actor.role)) {
    return { ok: false, error: `FORBIDDEN: Staff role '${actor.role}' is not authorized to record payments.`, code: 'FORBIDDEN' };
  }

  const parsed = LegacyBookingPaymentPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED: Invalid booking payment request.', code: 'VALIDATION_FAILED' };
  }
  const payload = parsed.data;

  // Branch authorization: non-owners cannot record payments for another branch
  const normalizedRole = actor.role.toLowerCase().trim();
  if (normalizedRole !== 'owner') {
    if (!actor.branchId || actor.branchId !== payload.branchId) {
      return { ok: false, error: 'BRANCH_MISMATCH: Staff member cannot record payments for another branch.', code: 'BRANCH_MISMATCH' };
    }
  }

  const client = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              branch_id: string;
              order_id: string | null;
              amount_paid: number | null;
              payment_status: string | null;
              status: string | null;
              metadata: Record<string, unknown> | null;
            } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data: booking, error: bookingError } = await client
    .from('bookings')
    .select('id, branch_id, order_id, amount_paid, payment_status, status, metadata')
    .eq('id', payload.bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { ok: false, error: 'BOOKING_NOT_FOUND: Booking is unavailable.', code: 'BOOKING_NOT_FOUND' };
  }
  if (booking.order_id !== null) {
    return { ok: false, error: 'SOURCE_MISMATCH: Use the order payment command for this booking.', code: 'SOURCE_MISMATCH' };
  }
  if (booking.branch_id !== payload.branchId) {
    return { ok: false, error: 'BRANCH_MISMATCH: Booking belongs to another branch.', code: 'BRANCH_MISMATCH' };
  }
  if (isBookingClosedForCrm(booking.status ?? '')) {
    return { ok: false, error: 'BOOKING_NOT_PAYABLE: This booking is closed and cannot receive payment.', code: 'BOOKING_NOT_PAYABLE' };
  }

  const total = validatedLegacyBookingPrice(booking.metadata);
  if (total === null) {
    return { ok: false, error: 'BOOKING_PRICE_INVALID: Booking price snapshot is unavailable.', code: 'BOOKING_PRICE_INVALID' };
  }

  const tenderCents = payload.payments.reduce((sum, part) => sum + Math.round(part.amount * 100), 0);
  const previousCents = Math.round(payload.expectedAmountPaid * 100);
  const targetCents = previousCents + tenderCents;
  const currentPaid = Number(booking.amount_paid ?? 0);
  const currentCents = Math.round(currentPaid * 100);

  if (
    !Number.isFinite(currentPaid) ||
    currentPaid < 0 ||
    targetCents > Math.round(total * 100) ||
    (currentCents !== previousCents && currentCents !== targetCents) ||
    (currentCents === previousCents && booking.payment_status === 'paid')
  ) {
    return { ok: false, error: 'PAYMENT_STATE_CHANGED: Refresh the booking balance before posting.', code: 'PAYMENT_STATE_CHANGED' };
  }

  const isFullPayment = targetCents === Math.round(total * 100);
  const shouldConfirm = isFullPayment && booking.status === 'pending_payment';

  const result = await recordBookingPaymentChange(supabase, {
    bookingId: booking.id,
    branchId: payload.branchId,
    paymentMethod: payload.payments.length === 1 ? payload.payments[0]!.paymentMethod : 'other',
    paymentStatus: isFullPayment ? 'paid' : 'pending',
    amountPaid: targetCents / 100,
    paymentReference: payload.payments.length === 1 ? payload.payments[0]!.externalReference ?? null : null,
    reason: payload.notes || 'Cash Flow payment',
    changedByStaffId: actor.staffId ?? null,
    nextStatus: shouldConfirm ? 'confirmed' : null,
    clearHold: shouldConfirm,
    idempotencyKey: payload.idempotencyKey,
    payments: payload.payments,
    businessDate: payload.businessDate,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, code: 'PAYMENT_REJECTED' };
  }

  try {
    revalidateOperationalBookingSurfaces(result.booking.branch_id);
  } catch {
    // Non-fatal if cache revalidation fails
  }

  return {
    ok: true,
    data: {
      success: true,
      transactionId: result.transactionId,
      paymentDelta: result.paymentDelta,
      isIdempotentReplay: result.isIdempotentReplay,
      branchId: result.booking.branch_id,
    },
  };
}
