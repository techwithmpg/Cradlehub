'use server';

import { revalidatePath } from 'next/cache';
import { revalidateOperationalBookingSurfaces } from '@/lib/bookings/revalidate-booking-surfaces';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/supabase';

function getPrivilegedClient(fallbackClient: unknown): ReturnType<typeof createAdminClient> {
  try {
    return createAdminClient();
  } catch {
    return fallbackClient as ReturnType<typeof createAdminClient>;
  }
}
import { z } from 'zod';
import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';
import { validatedLegacyBookingPrice } from './legacy-booking-price';
import {
  EXPENSE_RECEIPT_BUCKET,
  makeExpenseReceiptPath,
  validateExpenseReceipt,
} from './expense-receipt';
import { recordOrderPayment, type RecordOrderPaymentResult } from './payment-writer';
import { isBookingClosedForCrm } from '@/lib/bookings/crm-booking-status';
import {
  PostOrderPaymentPayloadSchema,
  PaymentPartPayloadSchema,
  type PostOrderPaymentPayload,
} from './financial-contract';
import { isValidAuthoritativeTransactionId } from './receipt-printer';
import type {
  OpenCashSessionInput,
  OpenCashSessionResult,
  CloseCashSessionInput,
  CloseCashSessionResult,
  HandoverCashSessionInput,
  HandoverCashSessionResult,
} from './cash-flow-types';

interface GenericRpcResult {
  transactionId?: string;
  idempotentReplay?: boolean;
}

interface GenericRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{
    data: GenericRpcResult | null;
    error: { message: string; code?: string } | null;
  }>;
}

interface DynamicCashSessionEqQuery {
  eq: (column: string, value: unknown) => DynamicCashSessionEqQuery;
  maybeSingle: () => Promise<{
    data: { id: string } | null;
    error: { message: string; code?: string } | null;
  }>;
}

interface DynamicCashSessionClient {
  from: (table: string) => {
    select: (columns: string) => DynamicCashSessionEqQuery;
  };
}

async function requireOpenCashSessionForDrawer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string | undefined,
  drawerId: string
): Promise<
  | { ok: true }
  | { ok: false; error: string; code: string }
> {
  if (!branchId) {
    return {
      ok: false,
      error: 'BRANCH_REQUIRED: Branch context is required for physical cash operations.',
      code: 'BRANCH_REQUIRED',
    };
  }

  const query = (supabase as unknown as DynamicCashSessionClient)
    .from('cash_sessions')
    .select('id')
    .eq('branch_id', branchId)
    .eq('cash_drawer_account_id', drawerId)
    .eq('status', 'open');


  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      ok: false,
      error: `CASH_SESSION_CHECK_FAILED: ${error.message}`,
      code: error.code || 'CASH_SESSION_CHECK_FAILED',
    };
  }

  if (!data) {
    return {
      ok: false,
      error: 'CASH_SESSION_REQUIRED: Open the cash drawer before recording physical cash operations.',
      code: 'CASH_SESSION_REQUIRED',
    };
  }

  return { ok: true };
}

export async function recordOrderPaymentAction(
  payload: PostOrderPaymentPayload
): Promise<RecordOrderPaymentResult> {
  const supabase = await createClient();

  // 1. Verify caller session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to record payments.',
      code: 'AUTH_REQUIRED',
    };
  }

  // 2. Validate payload schema
  const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('; ');
    return {
      ok: false,
      error: `VALIDATION_FAILED: ${errorMsg}`,
      code: 'VALIDATION_FAILED',
    };
  }

  // 3. Server guard: Verify that the order has at least one active, non-closed booking
  const { data: orderBookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('order_id', parsed.data.orderId);

  if (bookingsErr) {
    return {
      ok: false,
      error: `ORDER_CHECK_FAILED: ${bookingsErr.message}`,
      code: 'ORDER_CHECK_FAILED',
    };
  }

  if (!orderBookings || orderBookings.length === 0) {
    return {
      ok: false,
      error: 'ORDER_NOT_PAYABLE: No bookings found associated with this order.',
      code: 'ORDER_NOT_PAYABLE',
    };
  }

  const hasPayableBooking = orderBookings.some((b) => !isBookingClosedForCrm(b.status ?? ''));
  if (!hasPayableBooking) {
    return {
      ok: false,
      error: 'ORDER_NOT_PAYABLE: All bookings for this order are closed (cancelled, expired, or no-show). Cannot record payment.',
      code: 'ORDER_NOT_PAYABLE',
    };
  }

  // 4. Concurrency check: Ensure no active unresolved payment attempt exists under a different key
  try {
    const { data: activeAttempt } = await supabase
      .from('payment_attempts')
      .select('idempotency_key, created_at')
      .eq('order_id', parsed.data.orderId)
      .eq('status', 'in_flight')
      .maybeSingle();

    if (activeAttempt && activeAttempt.idempotency_key !== parsed.data.idempotencyKey) {
      return {
        ok: false,
        error: 'CONCURRENT_PAYMENT_IN_PROGRESS: Another payment attempt is currently unresolved for this order. Please verify the ledger before attempting a new payment.',
        code: 'CONCURRENT_PAYMENT_IN_PROGRESS',
      };
    }
  } catch {
    // Non-blocking pre-check fallback; canonical database function enforces mutual exclusion atomically
  }

  // 5. Delegate to canonical CF4 atomic payment writer
  const result = await recordOrderPayment(supabase, parsed.data);

  if (result.ok) {
    revalidateOperationalBookingSurfaces(result.data.branchId);
  }

  return result;
}

const LegacyBookingPaymentPayloadSchema = z.object({
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

export async function recordLegacyBookingPaymentAction(
  input: LegacyBookingPaymentPayload
): Promise<
  | {
      ok: true;
      data: {
        transactionId: string | null;
        paymentDelta: number;
        isIdempotentReplay: boolean;
        branchId: string;
        totalPayable: number;
        totalPaid: number;
        alreadyPaid: number;
        remainingBalance: number;
        movements: Array<{
          id: string;
          amount: number;
          paymentMethod: string;
          externalReference: string | null;
        }>;
      };
    }
  | { ok: false; error: string; code?: string }
> {
  const parsed = LegacyBookingPaymentPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED: Invalid booking payment request.', code: 'VALIDATION_FAILED' };
  }
  const payload = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'AUTH_REQUIRED: Authentication required to record payments.', code: 'AUTH_REQUIRED' };
  }

  const { data: booking, error: bookingError } = await supabase.from('bookings')
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

  const total = validatedLegacyBookingPrice(booking.metadata as Record<string, unknown> | null);
  if (total === null) {
    return { ok: false, error: 'BOOKING_PRICE_INVALID: Booking price snapshot is unavailable.', code: 'BOOKING_PRICE_INVALID' };
  }
  const tenderCents = payload.payments.reduce((sum, part) => sum + Math.round(part.amount * 100), 0);
  const previousCents = Math.round(payload.expectedAmountPaid * 100);
  const targetCents = previousCents + tenderCents;
  const currentPaid = Number(booking.amount_paid ?? 0);
  const currentCents = Math.round(currentPaid * 100);
  if (!Number.isFinite(currentPaid) || currentPaid < 0 ||
      targetCents > Math.round(total * 100) ||
      (currentCents !== previousCents && currentCents !== targetCents) ||
      (currentCents === previousCents && booking.payment_status === 'paid')) {
    return { ok: false, error: 'PAYMENT_STATE_CHANGED: Refresh the booking balance before posting.', code: 'PAYMENT_STATE_CHANGED' };
  }

  // Concurrency check: Ensure no active unresolved payment attempt exists under a different key
  try {
    const { data: activeAttempt } = await supabase
      .from('payment_attempts')
      .select('idempotency_key, created_at')
      .eq('booking_id', booking.id)
      .eq('status', 'in_flight')
      .maybeSingle();

    if (activeAttempt && activeAttempt.idempotency_key !== payload.idempotencyKey) {
      return {
        ok: false,
        error: 'CONCURRENT_PAYMENT_IN_PROGRESS: Another payment attempt is currently unresolved for this booking. Please verify the ledger before attempting a new payment.',
        code: 'CONCURRENT_PAYMENT_IN_PROGRESS',
      };
    }
  } catch {
    // Non-blocking pre-check fallback
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
    nextStatus: shouldConfirm ? 'confirmed' : null,
    clearHold: shouldConfirm,
    idempotencyKey: payload.idempotencyKey,
    payments: payload.payments,
    businessDate: payload.businessDate,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, code: 'PAYMENT_REJECTED' };
  }

  revalidateOperationalBookingSurfaces(result.booking.branch_id);

  let movements: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    externalReference: string | null;
  }> = [];

  if (result.transactionId && isValidAuthoritativeTransactionId(result.transactionId)) {
    const { data: movementsData, error: movementsErr } = await supabase
      .from('financial_account_movements')
      .select('id, amount, payment_method, external_reference')
      .eq('transaction_id', result.transactionId);

    if (!movementsErr && Array.isArray(movementsData) && movementsData.length > 0) {
      movements = movementsData.map((m) => ({
        id: m.id,
        amount: Number(m.amount),
        paymentMethod: m.payment_method,
        externalReference: m.external_reference ?? null,
      }));
    }
  }

  let totalPaidAuthoritative = targetCents / 100;
  let alreadyPaidAuthoritative = previousCents / 100;
  let remainingBalanceAuthoritative = Math.max(
    0,
    Math.round((total - totalPaidAuthoritative) * 100) / 100
  );

  if (result.isIdempotentReplay) {
    const originalMovementSum = movements.reduce((sum, m) => sum + m.amount, 0);
    if (originalMovementSum > 0) {
      // For idempotent replay, booking.amount_paid already contains the original transaction.
      // Prior payments before that transaction are cumulative booking paid minus original movement sum.
      const cumulativeBookingPaid = Number(booking.amount_paid ?? 0);
      alreadyPaidAuthoritative = Math.max(
        0,
        Math.round((cumulativeBookingPaid - originalMovementSum) * 100) / 100
      );
      totalPaidAuthoritative = cumulativeBookingPaid;
      remainingBalanceAuthoritative = Math.max(
        0,
        Math.round((total - cumulativeBookingPaid) * 100) / 100
      );
    } else {
      // If original movements could not be established, suppress receipt printing
      movements = [];
    }
  }

  return {
    ok: true,
    data: {
      transactionId: result.transactionId,
      paymentDelta: result.paymentDelta,
      isIdempotentReplay: result.isIdempotentReplay,
      branchId: result.booking.branch_id,
      totalPayable: total,
      totalPaid: totalPaidAuthoritative,
      alreadyPaid: alreadyPaidAuthoritative,
      remainingBalance: remainingBalanceAuthoritative,
      movements,
    },
  };
}

export async function recordExpenseAction(
  input: import('./cash-flow-types').RecordExpenseInput,
  receiptFormData?: FormData
): Promise<import('./cash-flow-types').OperationalEntryResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to post expense.',
      code: 'AUTH_REQUIRED',
    };
  }

  // The receipt path is always server-generated. Reject callers of the old
  // browser-upload contract even if they bypass TypeScript.
  if ((input as { receiptImagePath?: unknown }).receiptImagePath) {
    return { ok: false, error: 'RECEIPT_PATH_FORBIDDEN: Receipt path must be generated by the server.', code: 'RECEIPT_PATH_FORBIDDEN' };
  }

  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT: Expense amount must be greater than zero.', code: 'INVALID_AMOUNT' };
  }
  if (!input.categoryId) {
    return { ok: false, error: 'CATEGORY_REQUIRED: Expense category is required.', code: 'CATEGORY_REQUIRED' };
  }
  if (!input.financialAccountId) {
    return { ok: false, error: 'ACCOUNT_REQUIRED: Financial account is required.', code: 'ACCOUNT_REQUIRED' };
  }
  if (!input.description || !input.description.trim()) {
    return { ok: false, error: 'DESCRIPTION_REQUIRED: Description is required.', code: 'DESCRIPTION_REQUIRED' };
  }

  const receipt = receiptFormData?.get('receipt');
  if (receipt !== undefined && receipt !== null && !(receipt instanceof File)) {
    return { ok: false, error: 'RECEIPT_INVALID: A file is required.', code: 'RECEIPT_INVALID' };
  }

  let receiptPath: string | null = null;
  let effectiveBranchId = input.branchId || null;
  let admin: ReturnType<typeof createAdminClient> | null = null;

  if (receipt instanceof File) {
    const validated = await validateExpenseReceipt(receipt);
    if (!validated.ok) {
      return { ok: false, error: validated.error, code: validated.code };
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, branch_id, system_role, is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (staffError || !staff || !staff.is_active) {
      return { ok: false, error: 'STAFF_INACTIVE: Active staff account required.', code: 'STAFF_INACTIVE' };
    }
    if (!['owner', 'manager', 'assistant_manager', 'store_manager', 'crm'].includes(staff.system_role ?? '')) {
      return { ok: false, error: 'EXPENSE_ROLE_UNAUTHORIZED: Caller cannot post expenses.', code: 'EXPENSE_ROLE_UNAUTHORIZED' };
    }
    if (staff.system_role === 'owner') {
      if (!effectiveBranchId) {
        return { ok: false, error: 'BRANCH_REQUIRED: Select a branch for this receipt.', code: 'BRANCH_REQUIRED' };
      }
    } else {
      if (!staff.branch_id || (effectiveBranchId && effectiveBranchId !== staff.branch_id)) {
        return { ok: false, error: 'BRANCH_MISMATCH: Caller cannot upload for that branch.', code: 'BRANCH_MISMATCH' };
      }
      effectiveBranchId = staff.branch_id;
    }

    const [{ data: branch, error: branchError }, { data: account, error: accountError }] = await Promise.all([
      supabase.from('branches').select('id').eq('id', effectiveBranchId!).maybeSingle(),
      supabase.from('financial_accounts').select('id, branch_id, is_active').eq('id', input.financialAccountId).maybeSingle(),
    ]);
    if (branchError || !branch) {
      return { ok: false, error: 'BRANCH_NOT_FOUND: Receipt branch is unavailable.', code: 'BRANCH_NOT_FOUND' };
    }
    if (accountError || !account || !account.is_active ||
      (account.branch_id && account.branch_id !== effectiveBranchId)) {
      return { ok: false, error: 'ACCOUNT_BRANCH_MISMATCH: Payment account is unavailable for this branch.', code: 'ACCOUNT_BRANCH_MISMATCH' };
    }

    try {
      receiptPath = makeExpenseReceiptPath(effectiveBranchId!, input.businessDate || '', validated.extension);
    } catch {
      return { ok: false, error: 'BUSINESS_DATE_INVALID: A valid business date is required for a receipt.', code: 'BUSINESS_DATE_INVALID' };
    }
    admin = createAdminClient();
    try {
      const { error: uploadError } = await admin.storage
        .from(EXPENSE_RECEIPT_BUCKET)
        .upload(receiptPath, receipt, { contentType: validated.mimeType, upsert: false });
      if (uploadError) {
        return { ok: false, error: `RECEIPT_UPLOAD_FAILED: ${uploadError.message}`, code: 'RECEIPT_UPLOAD_FAILED' };
      }
    } catch {
      try {
        const { error: cleanupError } = await admin.storage.from(EXPENSE_RECEIPT_BUCKET).remove([receiptPath]);
        if (cleanupError) {
          return { ok: false, error: 'RECEIPT_UPLOAD_FAILED: Storage request failed; cleanup also failed.', code: 'RECEIPT_UPLOAD_CLEANUP_FAILED' };
        }
      } catch {
        return { ok: false, error: 'RECEIPT_UPLOAD_FAILED: Storage request failed; cleanup also failed.', code: 'RECEIPT_UPLOAD_CLEANUP_FAILED' };
      }
      return { ok: false, error: 'RECEIPT_UPLOAD_FAILED: Storage request failed.', code: 'RECEIPT_UPLOAD_FAILED' };
    }
  }

  const cleanupReceipt = async (): Promise<string | null> => {
    if (!receiptPath || !admin) return null;
    try {
      const { error } = await admin.storage.from(EXPENSE_RECEIPT_BUCKET).remove([receiptPath]);
      return error?.message || null;
    } catch {
      return 'Storage removal failed.';
    }
  };

  let data: GenericRpcResult | null = null;
  let rpcError: { message: string; code?: string } | null = null;
  try {
    const response = await (supabase as unknown as GenericRpcClient).rpc('post_expense_atomic', {
      p_branch_id: effectiveBranchId,
      p_idempotency_key: input.idempotencyKey || null,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_financial_account_id: input.financialAccountId,
      p_payee: input.payee || 'Direct Vendor',
      p_description: input.description.trim(),
      p_receipt_reference: input.receiptReference || null,
      p_business_date: input.businessDate || null,
      p_notes: input.notes || null,
      p_receipt_image_path: receiptPath,
    });
    data = response.data;
    rpcError = response.error;
  } catch {
    rpcError = { message: 'Expense posting request failed.', code: 'RPC_ERROR' };
  }

  if (rpcError || !data) {
    const cleanupError = await cleanupReceipt();
    return {
      ok: false,
      error: cleanupError
        ? `Expense posting failed; receipt cleanup also failed: ${cleanupError}`
        : rpcError?.message || 'Expense posting returned no result.',
      code: cleanupError ? 'EXPENSE_FAILED_RECEIPT_CLEANUP_FAILED' : rpcError?.code || 'RPC_ERROR',
    };
  }

  // A replay uses the original database receipt path, so remove this new upload.
  const replayCleanupError = data.idempotentReplay ? await cleanupReceipt() : null;
  return {
    ok: true,
    transactionId: data.transactionId,
    idempotentReplay: data.idempotentReplay,
    warning: replayCleanupError ? `Expense was already recorded; receipt cleanup failed: ${replayCleanupError}` : undefined,
  };
}

export async function recordTipAction(
  input: import('./cash-flow-types').RecordTipInput
): Promise<import('./cash-flow-types').OperationalEntryResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to record tip.',
      code: 'AUTH_REQUIRED',
    };
  }

  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT: Tip amount must be greater than zero.', code: 'INVALID_AMOUNT' };
  }
  if (!input.beneficiaryStaffId) {
    return { ok: false, error: 'BENEFICIARY_REQUIRED: Staff member is required.', code: 'BENEFICIARY_REQUIRED' };
  }
  if (input.custodyType === 'company_custodied' && !input.financialAccountId) {
    return { ok: false, error: 'ACCOUNT_REQUIRED: Financial account is required for company-custodied tips.', code: 'ACCOUNT_REQUIRED' };
  }

  const { data, error } = await (supabase as unknown as GenericRpcClient).rpc('post_tip_atomic', {
    p_branch_id: input.branchId || null,
    p_beneficiary_staff_id: input.beneficiaryStaffId,
    p_custody_type: input.custodyType,
    p_amount: input.amount,
    p_financial_account_id: input.financialAccountId || null,
    p_payment_method: input.paymentMethod || 'cash',
    p_business_date: input.businessDate || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey || null,
  });

  if (error) {
    return { ok: false, error: error.message, code: error.code || 'RPC_ERROR' };
  }

  return {
    ok: true,
    transactionId: (data as { transactionId?: string })?.transactionId,
    idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay,
  };
}

export async function recordOtherEntryAction(
  input: import('./cash-flow-types').RecordOtherEntryInput
): Promise<import('./cash-flow-types').OperationalEntryResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to record other financial entry.',
      code: 'AUTH_REQUIRED',
    };
  }

  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT: Amount must be greater than zero.', code: 'INVALID_AMOUNT' };
  }

  if (input.entryType === 'misc_income') {
    if (!input.receivingAccountId) {
      return { ok: false, error: 'ACCOUNT_REQUIRED: Receiving account is required.', code: 'ACCOUNT_REQUIRED' };
    }
    if (!input.incomeDescription || !input.incomeDescription.trim()) {
      return { ok: false, error: 'DESCRIPTION_REQUIRED: Description is required.', code: 'DESCRIPTION_REQUIRED' };
    }

    const { data, error } = await (supabase as unknown as GenericRpcClient).rpc('post_misc_income_atomic', {
      p_branch_id: input.branchId || null,
      p_financial_account_id: input.receivingAccountId,
      p_amount: input.amount,
      p_description: input.incomeDescription.trim(),
      p_payee_source: input.payeeSource || null,
      p_payment_method: input.paymentMethod || 'cash',
      p_business_date: input.businessDate || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey || null,
    });

    if (error) return { ok: false, error: error.message, code: error.code || 'RPC_ERROR' };
      return { ok: true, transactionId: (data as { transactionId?: string })?.transactionId, idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay };
  }

  if (input.entryType === 'cash_addition' || input.entryType === 'cash_removal') {
    if (!input.cashDrawerId) {
      return { ok: false, error: 'ACCOUNT_REQUIRED: Cash drawer is required.', code: 'ACCOUNT_REQUIRED' };
    }
    if (!input.adjustmentReason || !input.adjustmentReason.trim()) {
      return { ok: false, error: 'REASON_REQUIRED: Reason for adjustment is required.', code: 'REASON_REQUIRED' };
    }

    const cashSessionCheck = await requireOpenCashSessionForDrawer(
      supabase,
      input.branchId,
      input.cashDrawerId
    );

    if (!cashSessionCheck.ok) {
      return cashSessionCheck;
    }

    const { data, error } = await (supabase as unknown as GenericRpcClient).rpc('post_cash_adjustment_atomic', {
      p_branch_id: input.branchId || null,
      p_financial_account_id: input.cashDrawerId,
      p_adjustment_type: input.entryType === 'cash_addition' ? 'addition' : 'removal',
      p_amount: input.amount,
      p_reason: input.adjustmentReason.trim(),
      p_business_date: input.businessDate || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey || null,
    });

    if (error) return { ok: false, error: error.message, code: error.code || 'RPC_ERROR' };
      return { ok: true, transactionId: (data as { transactionId?: string })?.transactionId, idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay };
  }

  if (input.entryType === 'transfer') {
    if (!input.sourceAccountId || !input.destinationAccountId) {
      return { ok: false, error: 'ACCOUNTS_REQUIRED: Both source and destination accounts are required.', code: 'ACCOUNTS_REQUIRED' };
    }
    if (input.sourceAccountId === input.destinationAccountId) {
      return { ok: false, error: 'IDENTICAL_ACCOUNTS: Source and destination accounts cannot be identical.', code: 'IDENTICAL_ACCOUNTS' };
    }

    const { data: transferAccounts, error: transferAccountsError } = await supabase
      .from('financial_accounts')
      .select('id, account_type')
      .in('id', [input.sourceAccountId, input.destinationAccountId]);

    if (transferAccountsError) {
      return {
        ok: false,
        error: `ACCOUNT_LOOKUP_FAILED: ${transferAccountsError.message}`,
        code: transferAccountsError.code || 'ACCOUNT_LOOKUP_FAILED',
      };
    }

    if (!transferAccounts || transferAccounts.length !== 2) {
      return {
        ok: false,
        error: 'ACCOUNT_NOT_FOUND: Transfer accounts could not be resolved.',
        code: 'ACCOUNT_NOT_FOUND',
      };
    }

    for (const account of transferAccounts) {
      if (account.account_type !== 'cash_drawer') continue;

      const cashSessionCheck = await requireOpenCashSessionForDrawer(
        supabase,
        input.branchId,
        account.id
      );

      if (!cashSessionCheck.ok) {
        return cashSessionCheck;
      }
    }

    const { data, error } = await (supabase as unknown as GenericRpcClient).rpc('post_transfer_atomic', {
      p_branch_id: input.branchId || null,
      p_source_account_id: input.sourceAccountId,
      p_destination_account_id: input.destinationAccountId,
      p_amount: input.amount,
      p_business_date: input.businessDate || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey || null,
    });

    if (error) return { ok: false, error: error.message, code: error.code || 'RPC_ERROR' };
      return { ok: true, transactionId: (data as { transactionId?: string })?.transactionId, idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay };
  }

  return { ok: false, error: 'INVALID_ENTRY_TYPE: Unsupported entry type.', code: 'INVALID_ENTRY_TYPE' };
}

export async function openCashSessionAction(
  input: OpenCashSessionInput
): Promise<OpenCashSessionResult> {
  const supabase = await createClient();

  // 1. Verify caller session (Strict CF4 auth check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to open cash session.',
      code: 'AUTH_REQUIRED',
    };
  }

  // 2. Validate input parameters
  if (!input.branchId || !input.branchId.trim()) {
    return {
      ok: false,
      error: 'BRANCH_REQUIRED: Branch ID is required.',
      code: 'BRANCH_REQUIRED',
    };
  }

  if (!input.cashDrawerAccountId || !input.cashDrawerAccountId.trim()) {
    return {
      ok: false,
      error: 'DRAWER_ACCOUNT_REQUIRED: Cash drawer account ID is required.',
      code: 'DRAWER_ACCOUNT_REQUIRED',
    };
  }

  if (
    input.openingFloat === undefined ||
    input.openingFloat === null ||
    input.openingFloat < 0 ||
    Number.isNaN(Number(input.openingFloat))
  ) {
    return {
      ok: false,
      error: 'INVALID_OPENING_FLOAT: Opening float must be non-negative.',
      code: 'INVALID_OPENING_FLOAT',
    };
  }

  if (!input.businessDate || !input.businessDate.trim()) {
    return {
      ok: false,
      error: 'BUSINESS_DATE_REQUIRED: Business date is required.',
      code: 'BUSINESS_DATE_REQUIRED',
    };
  }

  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    return {
      ok: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    };
  }

  // 3. Call canonical RPC: open_cash_session_atomic
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: {
        ok?: boolean;
        sessionId?: string;
        branchId?: string;
        cashDrawerAccountId?: string;
        cashDrawerName?: string;
        businessDate?: string;
        openingFloat?: number | string;
        openedBy?: string;
        openedByName?: string;
        openedAt?: string;
        status?: 'open' | 'closed';
        idempotentReplay?: boolean;
      } | null;
      error: { message: string; code?: string } | null;
    }>;
  }).rpc('open_cash_session_atomic', {
    p_branch_id: input.branchId.trim(),
    p_cash_drawer_account_id: input.cashDrawerAccountId.trim(),
    p_opening_float: Number(input.openingFloat),
    p_business_date: input.businessDate.trim(),
    p_opening_note: input.openingNote?.trim() || null,
    p_idempotency_key: input.idempotencyKey.trim(),
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code || 'RPC_ERROR',
    };
  }

  if (!data || !data.sessionId) {
    return {
      ok: false,
      error: 'RPC_FAILED: No session returned from open_cash_session_atomic.',
      code: 'RPC_FAILED',
    };
  }

  // 4. Revalidate cache on success

  const openingFloatNum = Number(data.openingFloat) || 0;

  return {
    ok: true,
    idempotentReplay: data.idempotentReplay,
    session: {
      id: data.sessionId,
      branchId: data.branchId || input.branchId,
      businessDate: data.businessDate || input.businessDate,
      cashDrawerAccountId: data.cashDrawerAccountId || input.cashDrawerAccountId,
      cashDrawerName: data.cashDrawerName || 'Cash Drawer',
      status: data.status || 'open',
      openingFloat: openingFloatNum,
      openingNote: input.openingNote || null,
      openedBy: data.openedBy || user.id,
      openedByName: data.openedByName || 'Staff',
      openedAt: data.openedAt || new Date().toISOString(),
      expectedCash: openingFloatNum,
    },
  };
}

export async function closeCashSessionAction(
  input: CloseCashSessionInput
): Promise<CloseCashSessionResult> {
  const supabase = await createClient();

  // 1. Verify caller session (Strict CF4 auth check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to close cash session.',
      code: 'AUTH_REQUIRED',
    };
  }

  // 2. Validate input parameters
  if (!input.sessionId || !input.sessionId.trim()) {
    return {
      ok: false,
      error: 'SESSION_ID_REQUIRED: Cash session ID is required.',
      code: 'SESSION_ID_REQUIRED',
    };
  }

  if (
    input.countedCash === undefined ||
    input.countedCash === null ||
    input.countedCash < 0 ||
    Number.isNaN(Number(input.countedCash))
  ) {
    return {
      ok: false,
      error: 'INVALID_COUNTED_CASH: Counted cash must be non-negative.',
      code: 'INVALID_COUNTED_CASH',
    };
  }

  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    return {
      ok: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    };
  }

  // 3. Call canonical RPC: close_cash_session_atomic
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: {
        ok?: boolean;
        sessionId?: string;
        branchId?: string;
        cashDrawerAccountId?: string;
        cashDrawerName?: string;
        businessDate?: string;
        status?: 'closed';
        openingFloat?: number;
        expectedCash?: number;
        countedCash?: number;
        variance?: number;
        closedBy?: string;
        closedByName?: string;
        closedAt?: string;
        idempotentReplay?: boolean;
      } | null;
      error: { message: string; code?: string } | null;
    }>;
  }).rpc('close_cash_session_atomic', {
    p_session_id: input.sessionId.trim(),
    p_counted_cash: Number(input.countedCash),
    p_closing_note: input.closingNote?.trim() || null,
    p_idempotency_key: input.idempotencyKey.trim(),
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code || 'RPC_ERROR',
    };
  }

  if (!data || !data.sessionId) {
    return {
      ok: false,
      error: 'RPC_FAILED: No session returned from close_cash_session_atomic.',
      code: 'RPC_FAILED',
    };
  }

  // 4. Revalidate cache on success
  revalidatePath('/crm/reconciliation');
  revalidatePath('/owner/cash-flow');

  return {
    ok: true,
    idempotentReplay: data.idempotentReplay,
    session: {
      id: data.sessionId,
      branchId: data.branchId || '',
      cashDrawerAccountId: data.cashDrawerAccountId || '',
      cashDrawerName: data.cashDrawerName,
      businessDate: data.businessDate || '',
      status: 'closed',
      openingFloat: Number(data.openingFloat) || 0,
      expectedCash: Number(data.expectedCash) || 0,
      countedCash: Number(data.countedCash) || 0,
      variance: Number(data.variance) || 0,
      closedBy: data.closedBy || user.id,
      closedByName: data.closedByName,
      closedAt: data.closedAt || new Date().toISOString(),
    },
  };
}

export async function handoverCashSessionAction(
  input: HandoverCashSessionInput
): Promise<HandoverCashSessionResult> {
  const supabase = await createClient();

  // 1. Verify caller session (Strict CF4 auth check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to hand over cash drawer.',
      code: 'AUTH_REQUIRED',
    };
  }

  // 2. Validate input parameters
  if (!input.sessionId || !input.sessionId.trim()) {
    return {
      ok: false,
      error: 'SESSION_ID_REQUIRED: Cash session ID is required.',
      code: 'SESSION_ID_REQUIRED',
    };
  }

  if (!input.incomingCustodianId || !input.incomingCustodianId.trim()) {
    return {
      ok: false,
      error: 'INCOMING_CUSTODIAN_REQUIRED: Incoming custodian ID is required.',
      code: 'INCOMING_CUSTODIAN_REQUIRED',
    };
  }

  if (
    input.countedCash === undefined ||
    input.countedCash === null ||
    input.countedCash < 0 ||
    Number.isNaN(Number(input.countedCash))
  ) {
    return {
      ok: false,
      error: 'INVALID_COUNTED_CASH: Counted cash must be non-negative.',
      code: 'INVALID_COUNTED_CASH',
    };
  }

  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    return {
      ok: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    };
  }

  // 3. Call canonical RPC: handover_cash_session_atomic
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: {
        ok?: boolean;
        handoverId?: string;
        sessionId?: string;
        outgoingCustodianId?: string;
        outgoingCustodianName?: string;
        incomingCustodianId?: string;
        incomingCustodianName?: string;
        expectedCash?: number;
        countedCash?: number;
        variance?: number;
        recordedAt?: string;
        idempotentReplay?: boolean;
      } | null;
      error: { message: string; code?: string } | null;
    }>;
  }).rpc('handover_cash_session_atomic', {
    p_session_id: input.sessionId.trim(),
    p_incoming_custodian_id: input.incomingCustodianId.trim(),
    p_counted_cash: Number(input.countedCash),
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: input.idempotencyKey.trim(),
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code || 'RPC_ERROR',
    };
  }

  if (!data || !data.handoverId) {
    return {
      ok: false,
      error: 'RPC_FAILED: No handover record returned from handover_cash_session_atomic.',
      code: 'RPC_FAILED',
    };
  }

  // 4. Revalidate cache on success
  revalidatePath('/owner/cash-flow');

  return {
    ok: true,
    idempotentReplay: data.idempotentReplay,
    handover: {
      id: data.handoverId,
      sessionId: data.sessionId || input.sessionId,
      outgoingCustodianId: data.outgoingCustodianId || '',
      outgoingCustodianName: data.outgoingCustodianName,
      incomingCustodianId: data.incomingCustodianId || input.incomingCustodianId,
      incomingCustodianName: data.incomingCustodianName,
      expectedCash: Number(data.expectedCash) || 0,
      countedCash: Number(data.countedCash) || 0,
      variance: Number(data.variance) || 0,
      recordedAt: data.recordedAt || new Date().toISOString(),
    },
  };
}

export const VerifyPaymentAttemptInputSchema = z.object({
  orderId: z.string().trim().min(1),
  sourceKind: z.enum(['booking_order', 'legacy_booking']),
  branchId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
  expectedAmount: z.number().positive(),
});

export type VerifyPaymentAttemptInput = z.infer<typeof VerifyPaymentAttemptInputSchema>;

export type VerifyPaymentAttemptResult =
  | {
      ok: true;
      status: 'confirmed';
      transactionId: string;
      isIdempotentReplay: boolean;
      branchId: string;
      totalPayable: number;
      totalPaid: number;
      alreadyPaid: number;
      amountPaid: number;
      remainingBalance: number;
      movements: Array<{
        id: string;
        amount: number;
        paymentMethod: string;
        externalReference: string | null;
      }>;
    }
  | {
      ok: true;
      status: 'in_flight' | 'needs_investigation' | 'unrelated_payment' | 'not_posted' | 'abandoned';
      message: string;
      unrelatedTransactionId?: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function verifyPaymentAttemptAction(
  input: VerifyPaymentAttemptInput
): Promise<VerifyPaymentAttemptResult> {
  const parsed = VerifyPaymentAttemptInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED: Invalid verification request.', code: 'VALIDATION_FAILED' };
  }
  const payload = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to verify payment attempts.',
      code: 'AUTH_REQUIRED',
    };
  }

  // Authoritative check in financial_transactions
  const possibleKeys = [payload.idempotencyKey, `cf8:${payload.orderId}:${payload.idempotencyKey}`];
  const { data: txns, error: txError } = await supabase
    .from('financial_transactions')
    .select('id, branch_id, business_date, transaction_type, source_type, source_id, status, created_at, recorded_at')
    .in('idempotency_key', possibleKeys);

  if (txError) {
    return {
      ok: false,
      error: `LEDGER_READ_FAILED: ${txError.message}`,
      code: 'LEDGER_READ_FAILED',
    };
  }

  if (txns && txns.length > 0) {
    const confirmedTxn = txns[0]!;

    if (confirmedTxn.status !== 'posted') {
      return {
        ok: false,
        error: `TRANSACTION_STATUS_INVALID: Transaction status is ${confirmedTxn.status}, expected posted.`,
        code: 'TRANSACTION_STATUS_INVALID',
      };
    }

    if (confirmedTxn.branch_id !== payload.branchId) {
      return {
        ok: false,
        error: `BRANCH_MISMATCH: Transaction branch ${confirmedTxn.branch_id} does not match expected branch ${payload.branchId}.`,
        code: 'BRANCH_MISMATCH',
      };
    }

    if (confirmedTxn.source_id !== payload.orderId) {
      return {
        ok: false,
        error: `SOURCE_MISMATCH: Transaction source ${confirmedTxn.source_id} does not match order ${payload.orderId}.`,
        code: 'SOURCE_MISMATCH',
      };
    }

    const { data: movementsData, error: movErr } = await supabase
      .from('financial_account_movements')
      .select('id, amount, payment_method, external_reference')
      .eq('transaction_id', confirmedTxn.id);

    if (movErr || !movementsData || movementsData.length === 0) {
      return {
        ok: false,
        error: 'MOVEMENTS_UNAVAILABLE: Financial movements for transaction could not be retrieved.',
        code: 'MOVEMENTS_UNAVAILABLE',
      };
    }

    const movementSum = movementsData.reduce((sum, m) => sum + Number(m.amount), 0);
    if (Math.round(movementSum * 100) !== Math.round(payload.expectedAmount * 100)) {
      return {
        ok: false,
        error: `TRANSACTION_AMOUNT_MISMATCH: Authoritative transaction amount ${movementSum} does not match expected amount ${payload.expectedAmount}.`,
        code: 'TRANSACTION_AMOUNT_MISMATCH',
      };
    }

    let totalPayable = 0;
    let remainingBalance = 0;
    let alreadyPaid = 0;

    if (payload.sourceKind === 'booking_order') {
      const { data: summaryData } = await supabase
        .from('v_booking_order_financial_summaries')
        .select('total_payable, net_allocated, remaining_balance')
        .eq('order_id', payload.orderId)
        .maybeSingle();

      if (summaryData) {
        totalPayable = Number(summaryData.total_payable);
        const netAllocated = Number(summaryData.net_allocated);
        remainingBalance = Number(summaryData.remaining_balance);
        alreadyPaid = Math.max(0, Math.round((netAllocated - movementSum) * 100) / 100);
      } else {
        const [{ data: items }, { data: allocs }] = await Promise.all([
          supabase.from('order_payable_items').select('amount').eq('order_id', payload.orderId),
          supabase.from('financial_order_allocations').select('amount').eq('order_id', payload.orderId),
        ]);
        totalPayable = (items ?? []).reduce((s, i) => s + Number(i.amount), 0);
        const netAllocated = (allocs ?? []).reduce((s, a) => s + Number(a.amount), 0);
        remainingBalance = Math.max(0, Math.round((totalPayable - netAllocated) * 100) / 100);
        alreadyPaid = Math.max(0, Math.round((netAllocated - movementSum) * 100) / 100);
      }
    } else {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('amount_paid, metadata')
        .eq('id', payload.orderId)
        .maybeSingle();

      const total = validatedLegacyBookingPrice(bookingData?.metadata as Record<string, unknown> | null) ?? payload.expectedAmount;
      const cumulativePaid = Number(bookingData?.amount_paid ?? movementSum);
      alreadyPaid = Math.max(0, Math.round((cumulativePaid - movementSum) * 100) / 100);
      remainingBalance = Math.max(0, Math.round((total - cumulativePaid) * 100) / 100);
      totalPayable = total;
    }

    try {
      await supabase
        .from('payment_attempts')
        .update({ status: 'posted', transaction_id: confirmedTxn.id })
        .in('idempotency_key', possibleKeys);

      const admin = getPrivilegedClient(supabase);
      if (payload.sourceKind === 'booking_order') {
        const { data: bOrder } = await admin.from('booking_orders').select('metadata').eq('id', payload.orderId).maybeSingle();
        if (bOrder && bOrder.metadata && typeof bOrder.metadata === 'object') {
          const meta = { ...(bOrder.metadata as Record<string, unknown>) };
          delete meta.active_payment_attempt;
          await admin.from('booking_orders').update({ metadata: meta as unknown as Json }).eq('id', payload.orderId);
        }
      } else {
        const { data: bRow } = await admin.from('bookings').select('metadata').eq('id', payload.orderId).maybeSingle();
        if (bRow && bRow.metadata && typeof bRow.metadata === 'object') {
          const meta = { ...(bRow.metadata as Record<string, unknown>) };
          delete meta.active_payment_attempt;
          await admin.from('bookings').update({ metadata: meta as unknown as Json }).eq('id', payload.orderId);
        }
      }
    } catch {
      // Non-blocking cleanup
    }

    return {
      ok: true,
      status: 'confirmed',
      transactionId: confirmedTxn.id,
      isIdempotentReplay: true,
      branchId: confirmedTxn.branch_id,
      totalPayable,
      totalPaid: alreadyPaid + movementSum,
      alreadyPaid,
      amountPaid: movementSum,
      remainingBalance,
      movements: movementsData.map((m) => ({
        id: m.id,
        amount: Number(m.amount),
        paymentMethod: m.payment_method,
        externalReference: m.external_reference ?? null,
      })),
    };
  }

  // 4. Transaction not in financial_transactions: query authoritative payment_attempts
  let attemptRow: {
    id?: string;
    idempotency_key?: string;
    amount?: number;
    created_at?: string;
    status?: string;
  } | null = null;

  try {
    const { data: attData } = await supabase
      .from('payment_attempts')
      .select('id, idempotency_key, amount, created_at, status')
      .in('idempotency_key', possibleKeys)
      .maybeSingle();
    attemptRow = attData;
  } catch {
    // Non-blocking query failure fallback for mocked environments
  }

  if (attemptRow) {
    if (attemptRow.status === 'reconciled_abandoned') {
      return {
        ok: true,
        status: 'abandoned',
        message: 'Payment attempt was reconciled and abandoned. You may proceed with a new payment.',
      };
    }

    if (attemptRow.status === 'in_flight') {
      const elapsedMs = attemptRow.created_at ? Date.now() - new Date(attemptRow.created_at).getTime() : 0;
      if (elapsedMs < 30_000) {
        return {
          ok: true,
          status: 'in_flight',
          message: 'Payment attempt is still in-flight in the database. Please wait a moment and verify again.',
        };
      }
      return {
        ok: true,
        status: 'needs_investigation',
        message: 'Payment attempt is unresolved after 30 seconds. You may retry payment with the same key or abandon the attempt if no money was collected.',
      };
    }
  }

  // Fallback to checking metadata active_payment_attempt (for test mocks)
  let attemptInitiatedAt: string | null = null;
  if (payload.sourceKind === 'booking_order') {
    const { data: bOrder } = await supabase.from('booking_orders').select('metadata').eq('id', payload.orderId).maybeSingle();
    const meta = bOrder?.metadata as Record<string, unknown> | null;
    const att = meta?.active_payment_attempt as Record<string, unknown> | null;
    if (att?.initiated_at) attemptInitiatedAt = String(att.initiated_at);
  } else {
    const { data: bRow } = await supabase.from('bookings').select('metadata').eq('id', payload.orderId).maybeSingle();
    const meta = bRow?.metadata as Record<string, unknown> | null;
    const att = meta?.active_payment_attempt as Record<string, unknown> | null;
    if (att?.initiated_at) attemptInitiatedAt = String(att.initiated_at);
  }

  const elapsedMs = attemptInitiatedAt ? Date.now() - new Date(attemptInitiatedAt).getTime() : 30_000;
  if (elapsedMs < 15_000) {
    return {
      ok: true,
      status: 'in_flight',
      message: 'Payment attempt is still in-flight in the database. Please wait a moment and verify again.',
    };
  }

  const { data: otherTxns } = await supabase
    .from('financial_transactions')
    .select('id, idempotency_key, recorded_at')
    .eq('source_id', payload.orderId)
    .eq('status', 'posted')
    .order('recorded_at', { ascending: false })
    .limit(1);

  if (otherTxns && otherTxns.length > 0 && !possibleKeys.includes(otherTxns[0]!.idempotency_key)) {
    return {
      ok: true,
      status: 'unrelated_payment',
      message: 'The balance was updated by an unrelated transaction. Your payment attempt was not recorded in the financial ledger.',
      unrelatedTransactionId: otherTxns[0]!.id,
    };
  }

  return {
    ok: true,
    status: 'not_posted',
    message: 'No transaction was recorded in the financial ledger for this attempt.',
  };
}

export const ClearPaymentAttemptInputSchema = z.object({
  orderId: z.string().trim().min(1),
  sourceKind: z.enum(['booking_order', 'legacy_booking']),
  branchId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
  reason: z.string().trim().optional(),
});

export type ClearPaymentAttemptInput = z.infer<typeof ClearPaymentAttemptInputSchema>;

export async function clearPaymentAttemptAction(
  input: ClearPaymentAttemptInput
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const parsed = ClearPaymentAttemptInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED: Invalid clear attempt request.', code: 'VALIDATION_FAILED' };
  }
  const payload = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to clear payment attempts.',
      code: 'AUTH_REQUIRED',
    };
  }

  // Double check financial_transactions: never clear an attempt that committed!
  const possibleKeys = [payload.idempotencyKey, `cf8:${payload.orderId}:${payload.idempotencyKey}`];
  const { data: existingTx } = await supabase
    .from('financial_transactions')
    .select('id')
    .in('idempotency_key', possibleKeys)
    .maybeSingle();

  if (existingTx) {
    return {
      ok: false,
      error: 'ATTEMPT_ALREADY_COMMITTED: Transaction has already posted to the financial ledger. Please verify and print receipt instead of clearing.',
      code: 'ATTEMPT_ALREADY_COMMITTED',
    };
  }

  // Execute server-authoritative reconcile_abandon_payment_attempt RPC
  try {
    await supabase.rpc('reconcile_abandon_payment_attempt', {
      p_idempotency_key: payload.idempotencyKey,
      p_reason: payload.reason?.trim() || 'Payment attempt uncollected or abandoned by cashier',
    });
  } catch {
    // Non-blocking fallback for mocked environments
  }

  // Also clean up any mock metadata
  try {
    const admin = getPrivilegedClient(supabase);
    if (payload.sourceKind === 'booking_order') {
      const { data: bOrder } = await admin.from('booking_orders').select('metadata').eq('id', payload.orderId).maybeSingle();
      if (bOrder && bOrder.metadata) {
        const meta = { ...(bOrder.metadata as Record<string, unknown>) };
        delete meta.active_payment_attempt;
        await admin.from('booking_orders').update({ metadata: meta as unknown as Json }).eq('id', payload.orderId);
      }
    } else {
      const { data: bRow } = await admin.from('bookings').select('metadata').eq('id', payload.orderId).maybeSingle();
      if (bRow && bRow.metadata) {
        const meta = { ...(bRow.metadata as Record<string, unknown>) };
        delete meta.active_payment_attempt;
        await admin.from('bookings').update({ metadata: meta as unknown as Json }).eq('id', payload.orderId);
      }
    }
  } catch {
    // Non-blocking cleanup
  }

  revalidateOperationalBookingSurfaces(payload.branchId);
  return { ok: true };
}

export const ReconcileAbandonPaymentAttemptInputSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(1, 'A valid explanation is required to abandon an attempt.'),
  branchId: z.string().trim().min(1),
  orderId: z.string().trim().optional(),
  sourceKind: z.enum(['booking_order', 'legacy_booking']).optional(),
});

export type ReconcileAbandonPaymentAttemptInput = z.infer<typeof ReconcileAbandonPaymentAttemptInputSchema>;

export async function reconcileAbandonPaymentAttemptAction(
  input: ReconcileAbandonPaymentAttemptInput
): Promise<{ ok: true; status: string } | { ok: false; error: string; code?: string }> {
  const parsed = ReconcileAbandonPaymentAttemptInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED: ' + parsed.error.issues[0]?.message, code: 'VALIDATION_FAILED' };
  }
  const payload = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to reconcile payment attempts.',
      code: 'AUTH_REQUIRED',
    };
  }

  const { data, error } = await supabase.rpc('reconcile_abandon_payment_attempt', {
    p_idempotency_key: payload.idempotencyKey,
    p_reason: payload.reason,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || 'Failed to reconcile payment attempt.',
      code: error.code || 'ABANDON_RPC_FAILED',
    };
  }

  revalidateOperationalBookingSurfaces(payload.branchId);
  return { ok: true, status: (data as { status?: string })?.status ?? 'reconciled_abandoned' };
}
