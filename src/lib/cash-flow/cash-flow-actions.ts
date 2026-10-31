'use server';

import { revalidatePath } from 'next/cache';
import { revalidateOperationalBookingSurfaces } from '@/lib/bookings/revalidate-booking-surfaces';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';
import { validatedLegacyBookingPrice } from './legacy-booking-price';
import {
  isValidAuthoritativeTransactionId,
  type PrintableReceiptData,
} from './receipt-printer';
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

  // 4. Delegate to canonical CF4 atomic payment writer
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
  | { ok: true; data: { transactionId: string | null; paymentDelta: number; isIdempotentReplay: boolean; branchId: string } }
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
  if (!result.ok) return { ok: false, error: result.error, code: 'PAYMENT_REJECTED' };
  revalidateOperationalBookingSurfaces(result.booking.branch_id);
  return {
    ok: true,
    data: {
      transactionId: result.transactionId,
      paymentDelta: result.paymentDelta,
      isIdempotentReplay: result.isIdempotentReplay,
      branchId: result.booking.branch_id,
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

const VerifyPaymentTransactionInputSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255),
  branchId: z.string().trim().min(1),
  orderId: z.string().trim().optional(),
});

export type VerifyPaymentTransactionInput = z.infer<typeof VerifyPaymentTransactionInputSchema>;

export interface VerifiedFinancialMovement {
  id: string;
  financialAccountId: string;
  amount: number;
  paymentMethod: string;
  externalReference: string | null;
}

export interface VerifiedFinancialTransaction {
  id: string;
  branchId: string;
  transactionType: string;
  status: string;
  businessDate: string;
  occurredAt: string;
  sourceType: string | null;
  sourceId: string | null;
  externalReference: string | null;
  notes: string | null;
  movements: VerifiedFinancialMovement[];
}

export type VerifyPaymentTransactionResult =
  | {
      ok: true;
      status: 'committed';
      transaction: VerifiedFinancialTransaction;
    }
  | {
      ok: true;
      status: 'not_found';
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function verifyPaymentTransactionAction(
  input: VerifyPaymentTransactionInput
): Promise<VerifyPaymentTransactionResult> {
  const parsed = VerifyPaymentTransactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'VALIDATION_FAILED: ' + parsed.error.issues.map((i) => i.message).join('; '),
      code: 'VALIDATION_FAILED',
    };
  }
  const payload = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to verify transactions.',
      code: 'AUTH_REQUIRED',
    };
  }

  // Verify staff role & branch access
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id, branch_id, system_role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (staffError || !staff || !staff.is_active) {
    return {
      ok: false,
      error: 'STAFF_NOT_FOUND: Active staff record required.',
      code: 'STAFF_UNAUTHORIZED',
    };
  }

  if (!['owner', 'manager', 'assistant_manager', 'store_manager', 'crm'].includes(staff.system_role)) {
    return {
      ok: false,
      error: 'PAYMENT_ROLE_UNAUTHORIZED: Role cannot verify transactions.',
      code: 'PAYMENT_ROLE_UNAUTHORIZED',
    };
  }

  if (staff.system_role !== 'owner' && staff.branch_id !== payload.branchId) {
    return {
      ok: false,
      error: 'BRANCH_UNAUTHORIZED: Caller branch does not match transaction branch.',
      code: 'BRANCH_UNAUTHORIZED',
    };
  }

  // Authoritative query against public.financial_transactions governed by RLS
  const { data: tx, error: txError } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      branch_id,
      transaction_type,
      status,
      business_date,
      occurred_at,
      source_type,
      source_id,
      external_reference,
      notes,
      financial_account_movements (
        id,
        financial_account_id,
        amount,
        payment_method,
        external_reference
      )
    `)
    .eq('idempotency_key', payload.idempotencyKey)
    .maybeSingle();

  if (txError) {
    return {
      ok: false,
      error: `QUERY_FAILED: ${txError.message}`,
      code: txError.code || 'QUERY_FAILED',
    };
  }

  if (!tx) {
    return {
      ok: true,
      status: 'not_found',
    };
  }

  const movements: VerifiedFinancialMovement[] = Array.isArray(tx.financial_account_movements)
    ? (tx.financial_account_movements as unknown as Array<{
        id: string;
        financial_account_id: string;
        amount: number | string;
        payment_method: string;
        external_reference: string | null;
      }>).map((m) => ({
        id: String(m.id),
        financialAccountId: String(m.financial_account_id),
        amount: Number(m.amount) || 0,
        paymentMethod: String(m.payment_method),
        externalReference: m.external_reference ? String(m.external_reference) : null,
      }))
    : [];

  return {
    ok: true,
    status: 'committed',
    transaction: {
      id: String(tx.id),
      branchId: String(tx.branch_id),
      transactionType: String(tx.transaction_type),
      status: String(tx.status),
      businessDate: String(tx.business_date),
      occurredAt: String(tx.occurred_at),
      sourceType: tx.source_type ? String(tx.source_type) : null,
      sourceId: tx.source_id ? String(tx.source_id) : null,
      externalReference: tx.external_reference ? String(tx.external_reference) : null,
      notes: tx.notes ? String(tx.notes) : null,
      movements,
    },
  };
}

const GetPrintableReceiptInputSchema = z.string().trim().refine(isValidAuthoritativeTransactionId, {
  message: 'Invalid authoritative transaction ID',
});

export type GetPrintableReceiptResult =
  | {
      ok: true;
      data: PrintableReceiptData;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function getPrintableReceiptAction(
  transactionId: string
): Promise<GetPrintableReceiptResult> {
  const parsed = GetPrintableReceiptInputSchema.safeParse(transactionId);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'VALIDATION_FAILED: Invalid transaction ID.',
      code: 'VALIDATION_FAILED',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'AUTH_REQUIRED: Authentication required to retrieve receipts.',
      code: 'AUTH_REQUIRED',
    };
  }

  // Verify staff role & branch access
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id, branch_id, system_role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (staffError || !staff || !staff.is_active) {
    return {
      ok: false,
      error: 'STAFF_NOT_FOUND: Active staff record required.',
      code: 'STAFF_UNAUTHORIZED',
    };
  }

  if (!['owner', 'manager', 'assistant_manager', 'store_manager', 'crm'].includes(staff.system_role)) {
    return {
      ok: false,
      error: 'PAYMENT_ROLE_UNAUTHORIZED: Role cannot retrieve receipts.',
      code: 'PAYMENT_ROLE_UNAUTHORIZED',
    };
  }

  // Fetch transaction with movements and branch
  const { data: tx, error: txError } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      branch_id,
      transaction_type,
      status,
      business_date,
      occurred_at,
      created_at,
      source_type,
      source_id,
      external_reference,
      notes,
      branches ( name ),
      financial_account_movements (
        id,
        financial_account_id,
        amount,
        payment_method,
        external_reference
      )
    `)
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) {
    return {
      ok: false,
      error: `QUERY_FAILED: ${txError.message}`,
      code: txError.code || 'QUERY_FAILED',
    };
  }

  if (!tx) {
    return {
      ok: false,
      error: 'TRANSACTION_NOT_FOUND: Financial transaction not found.',
      code: 'TRANSACTION_NOT_FOUND',
    };
  }

  if (staff.system_role !== 'owner' && staff.branch_id !== tx.branch_id) {
    return {
      ok: false,
      error: 'BRANCH_UNAUTHORIZED: Caller branch does not match transaction branch.',
      code: 'BRANCH_UNAUTHORIZED',
    };
  }

  // 1. Transaction Type & Status Guard (Requirement 1)
  if (!['customer_payment', 'customer_deposit'].includes(tx.transaction_type)) {
    return {
      ok: false,
      error: `INVALID_TRANSACTION_TYPE: Only customer payment or deposit transactions can produce customer receipts. Found '${tx.transaction_type}'.`,
      code: 'INVALID_TRANSACTION_TYPE',
    };
  }

  if (tx.status !== 'posted') {
    return {
      ok: false,
      error: `TRANSACTION_NOT_POSTED: Cannot generate receipt for transaction with status '${tx.status}'. Only posted transactions are eligible.`,
      code: 'TRANSACTION_NOT_POSTED',
    };
  }

  // 2. Source Guard (Requirement 1)
  const sourceType = tx.source_type;
  const sourceId = tx.source_id;
  if ((sourceType !== 'booking_order' && sourceType !== 'legacy_booking') || !sourceId) {
    return {
      ok: false,
      error: 'INVALID_TRANSACTION_SOURCE: Transaction must have a valid booking_order or legacy_booking source.',
      code: 'INVALID_TRANSACTION_SOURCE',
    };
  }

  // 3. Fetch allocations for booking_order (Correction A & B)
  const allocationByMovementId = new Map<string, number>();
  if (sourceType === 'booking_order') {
    const { data: orderAllocs, error: allocError } = await supabase
      .from('financial_order_allocations')
      .select('id, financial_account_movement_id, amount')
      .eq('order_id', sourceId);

    if (allocError) {
      return {
        ok: false,
        error: `HISTORICAL_QUERY_FAILED: Failed to fetch order allocations: ${allocError.message}`,
        code: 'HISTORICAL_QUERY_FAILED',
      };
    }

    if (Array.isArray(orderAllocs)) {
      for (const a of orderAllocs) {
        const aAmt = Number(a.amount);
        if (!Number.isFinite(aAmt) || aAmt <= 0) {
          return {
            ok: false,
            error: `MALFORMED_FINANCIAL_EVIDENCE: Order allocation ${a.id} contains invalid or non-positive amount.`,
            code: 'MALFORMED_FINANCIAL_EVIDENCE',
          };
        }
        const prev = allocationByMovementId.get(a.financial_account_movement_id) || 0;
        allocationByMovementId.set(a.financial_account_movement_id, prev + aAmt);
      }
    }
  }

  // 4. Movement Integrity Guard (Strict positive amounts, no Math.abs) (Requirement 1)
  const rawMovements = Array.isArray(tx.financial_account_movements)
    ? tx.financial_account_movements
    : [];

  if (rawMovements.length === 0) {
    return {
      ok: false,
      error: 'INVALID_MOVEMENTS: Transaction has no financial account movements.',
      code: 'INVALID_MOVEMENTS',
    };
  }

  const movements: Array<{ method: string; amount: number; reference: string | null }> = [];
  for (const m of rawMovements as Array<{
    id?: unknown;
    amount: unknown;
    payment_method: unknown;
    external_reference: unknown;
  }>) {
    const amt = Number(m.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return {
        ok: false,
        error: 'INVALID_MOVEMENT_AMOUNT: Receipt movements must be positive verified amounts.',
        code: 'INVALID_MOVEMENTS',
      };
    }
    const methodStr = String(m.payment_method ?? '').trim();
    if (!methodStr) {
      return {
        ok: false,
        error: 'INVALID_PAYMENT_METHOD: Movement missing payment method.',
        code: 'INVALID_MOVEMENTS',
      };
    }
    const movementId = m.id ? String(m.id) : undefined;
    const allocatedAmt = movementId ? allocationByMovementId.get(movementId) : undefined;
    const effectiveMovementAmt = allocatedAmt !== undefined ? allocatedAmt : amt;
    if (!Number.isFinite(effectiveMovementAmt) || effectiveMovementAmt <= 0) {
      return {
        ok: false,
        error: 'INVALID_MOVEMENT_AMOUNT: Receipt movements must be positive verified amounts.',
        code: 'INVALID_MOVEMENTS',
      };
    }
    movements.push({
      method: methodStr,
      amount: effectiveMovementAmt,
      reference: m.external_reference ? String(m.external_reference) : null,
    });
  }

  const amountPaid = Math.round(movements.reduce((acc, m) => acc + m.amount, 0) * 100) / 100;
  if (amountPaid <= 0) {
    return {
      ok: false,
      error: 'INVALID_PAYMENT_AMOUNT: Total payment amount must be greater than zero.',
      code: 'INVALID_PAYMENT_AMOUNT',
    };
  }

  // 5. Authoritative Historical Reconstruction (Correction A & B)
  // Reconstruct net previously paid and historical payable total at the time of the original transaction
  // accounting for refunds, reversals, and financial_order_allocations.

  // Fetch sibling transactions (payments, deposits, and refunds)
  const { data: siblingTxs, error: siblingError } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      occurred_at,
      created_at,
      status,
      transaction_type,
      reversal_of_transaction_id,
      financial_account_movements (
        id,
        amount,
        payment_method,
        external_reference
      )
    `)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .in('transaction_type', ['customer_payment', 'customer_deposit', 'customer_refund']);

  if (siblingError) {
    return {
      ok: false,
      error: `HISTORICAL_QUERY_FAILED: Failed to fetch sibling transactions: ${siblingError.message}`,
      code: 'HISTORICAL_QUERY_FAILED',
    };
  }

  const allTxs: Array<{
    id: string;
    occurred_at: string;
    created_at?: string;
    status: string;
    transaction_type: string;
    reversal_of_transaction_id?: string | null;
    financial_account_movements?: unknown;
  }> = Array.isArray(siblingTxs) ? [...siblingTxs] : [];

  if (!allTxs.some((t) => t.id === tx.id)) {
    allTxs.push(tx);
  }

  // Track reversals & voids
  const voidedOrReversedIds = new Set<string>();
  for (const stx of allTxs) {
    if (stx.status === 'voided' || stx.status === 'reversed') {
      voidedOrReversedIds.add(stx.id);
    }
    if (stx.reversal_of_transaction_id) {
      voidedOrReversedIds.add(stx.reversal_of_transaction_id);
    }
  }

  // Validate financial movements across all sibling transactions (Reject malformed/incomplete evidence)
  for (const stx of allTxs) {
    const rawM = Array.isArray(stx.financial_account_movements)
      ? stx.financial_account_movements
      : [];
    if (rawM.length === 0) {
      return {
        ok: false,
        error: `MALFORMED_FINANCIAL_EVIDENCE: Transaction ${stx.id} has no financial account movements.`,
        code: 'MALFORMED_FINANCIAL_EVIDENCE',
      };
    }
    for (const pm of rawM as Array<{ amount: unknown; payment_method: unknown }>) {
      const amt = Number(pm.amount);
      if (!Number.isFinite(amt) || amt === 0) {
        return {
          ok: false,
          error: `MALFORMED_FINANCIAL_EVIDENCE: Transaction ${stx.id} contains invalid, non-finite, or zero movement amount.`,
          code: 'MALFORMED_FINANCIAL_EVIDENCE',
        };
      }
      const methodStr = String(pm.payment_method ?? '').trim();
      if (!methodStr) {
        return {
          ok: false,
          error: `MALFORMED_FINANCIAL_EVIDENCE: Transaction ${stx.id} movement is missing payment method.`,
          code: 'MALFORMED_FINANCIAL_EVIDENCE',
        };
      }
    }
  }

  // Sort chronologically by occurred_at, then created_at, with id as deterministic tie-breaker
  allTxs.sort((a, b) => {
    const timeA = new Date(a.occurred_at).getTime();
    const timeB = new Date(b.occurred_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const createdA = a.created_at ? new Date(a.created_at).getTime() : timeA;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : timeB;
    if (createdA !== createdB) return createdA - createdB;
    return String(a.id).localeCompare(String(b.id));
  });

  const currentIndex = allTxs.findIndex((t) => t.id === tx.id);
  if (currentIndex === -1) {
    return {
      ok: false,
      error: 'HISTORICAL_POSITION_FAILED: Current transaction could not be sequenced.',
      code: 'HISTORICAL_POSITION_FAILED',
    };
  }

  let alreadyPaidCents = 0;
  for (let i = 0; i < currentIndex; i++) {
    const prior = allTxs[i]!;

    // If voided, reversed, or is a reversal itself, net effect is 0
    if (
      prior.status === 'voided' ||
      prior.status === 'reversed' ||
      voidedOrReversedIds.has(prior.id) ||
      prior.reversal_of_transaction_id
    ) {
      continue;
    }

    const priorMovs = prior.financial_account_movements as Array<{ id: string; amount: unknown }>;

    if (prior.transaction_type === 'customer_payment' || prior.transaction_type === 'customer_deposit') {
      let txInflowCents = 0;
      for (const pm of priorMovs) {
        const pAmt = Number(pm.amount);
        const allocated = allocationByMovementId.get(pm.id);
        const effectiveAmt = allocated !== undefined ? allocated : pAmt;
        if (effectiveAmt <= 0) {
          return {
            ok: false,
            error: `MALFORMED_FINANCIAL_EVIDENCE: Movement ${pm.id} has invalid non-positive effective allocation.`,
            code: 'MALFORMED_FINANCIAL_EVIDENCE',
          };
        }
        txInflowCents += Math.round(effectiveAmt * 100);
      }
      alreadyPaidCents += txInflowCents;
    } else if (prior.transaction_type === 'customer_refund') {
      let txOutflowCents = 0;
      for (const pm of priorMovs) {
        const pAmt = Number(pm.amount);
        const refundMagnitude = Math.abs(pAmt);
        txOutflowCents += Math.round(refundMagnitude * 100);
      }
      alreadyPaidCents -= txOutflowCents;
    }
  }

  const alreadyPaid = Math.max(0, alreadyPaidCents / 100);

  // Retrieve order or booking details and establish authoritative historical total payable
  let orderNumber = tx.external_reference || `TXN-${String(tx.id).slice(0, 8)}`;
  let customerName = tx.notes || 'Guest';
  let customerPhone: string | null = null;
  let serviceDescription = 'Spa Services';
  let visitType: 'in_spa' | 'home_service' = 'in_spa';
  let items: Array<{ description: string; amount: number }> = [];
  let totalPayable: number | null = null;

  const txTimestamp = new Date(tx.created_at || tx.occurred_at).getTime();

  if (sourceType === 'booking_order') {
    const { data: order, error: orderErr } = await supabase
      .from('booking_orders')
      .select(`
        id,
        order_number,
        delivery_type,
        customers:organizer_customer_id ( full_name, phone )
      `)
      .eq('id', sourceId)
      .maybeSingle();

    if (orderErr) {
      return {
        ok: false,
        error: `QUERY_FAILED: Failed to fetch booking order: ${orderErr.message}`,
        code: 'QUERY_FAILED',
      };
    }

    if (order) {
      if (order.order_number) orderNumber = order.order_number;
      if (order.delivery_type === 'home_service') visitType = 'home_service';
      const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      if (cust?.full_name) customerName = cust.full_name;
      if (cust?.phone) customerPhone = cust.phone;
    }

    // Fetch all payable items for this order
    const { data: allPayableItems, error: itemsErr } = await supabase
      .from('order_payable_items')
      .select('id, description, amount, sequence, created_at')
      .eq('order_id', sourceId)
      .order('sequence');

    if (itemsErr) {
      return {
        ok: false,
        error: `QUERY_FAILED: Failed to fetch payable items: ${itemsErr.message}`,
        code: 'QUERY_FAILED',
      };
    }

    // Filter items that existed at or before this transaction's execution
    // (allow up to 5000ms margin for same-request commit ordering)
    const historicalPayableItems = Array.isArray(allPayableItems)
      ? allPayableItems.filter((item) => {
          if (!item.created_at) return true;
          const itemTime = new Date(item.created_at).getTime();
          return itemTime <= txTimestamp + 5000;
        })
      : [];

    if (historicalPayableItems.length === 0) {
      return {
        ok: false,
        error: 'UNVERIFIED_HISTORICAL_PAYABLE: The payable total at the time of the original transaction cannot be verified from historical records.',
        code: 'UNVERIFIED_HISTORICAL_PAYABLE',
      };
    }

    items = historicalPayableItems.map((item) => ({
      description: item.description || 'Service',
      amount: Number(item.amount) || 0,
    }));
    serviceDescription = items.map((i) => i.description).join(', ');

    let sumCents = 0;
    for (const it of items) {
      if (!Number.isFinite(it.amount) || it.amount <= 0) {
        return {
          ok: false,
          error: 'UNVERIFIED_HISTORICAL_PAYABLE: Historical payable item contains invalid or non-positive amount.',
          code: 'UNVERIFIED_HISTORICAL_PAYABLE',
        };
      }
      sumCents += Math.round(it.amount * 100);
    }
    totalPayable = sumCents / 100;
  } else if (sourceType === 'legacy_booking') {
    const { data: b, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        id,
        delivery_type,
        metadata,
        customers:customer_id ( full_name, phone ),
        services:service_id ( name )
      `)
      .eq('id', sourceId)
      .maybeSingle();

    if (bookingErr || !b) {
      return {
        ok: false,
        error: 'BOOKING_NOT_FOUND: Legacy booking record could not be found.',
        code: 'BOOKING_NOT_FOUND',
      };
    }

    orderNumber = `BK-${b.id.slice(0, 8)}`;
    const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    if (cust?.full_name) customerName = cust.full_name;
    if (cust?.phone) customerPhone = cust.phone;
    const svc = Array.isArray(b.services) ? b.services[0] : b.services;
    if (svc?.name) serviceDescription = svc.name;
    if (b.delivery_type === 'home_service') visitType = 'home_service';

    const validatedPrice = validatedLegacyBookingPrice(b.metadata as Record<string, unknown> | null);
    if (validatedPrice === null || validatedPrice <= 0 || !Number.isFinite(validatedPrice)) {
      return {
        ok: false,
        error: 'UNVERIFIED_HISTORICAL_PAYABLE: Legacy booking price could not be established from metadata snapshot.',
        code: 'UNVERIFIED_HISTORICAL_PAYABLE',
      };
    }
    totalPayable = validatedPrice;
    items = [{ description: serviceDescription, amount: totalPayable }];
  } else {
    return {
      ok: false,
      error: 'INVALID_TRANSACTION_SOURCE: Transaction source must be booking_order or legacy_booking.',
      code: 'INVALID_TRANSACTION_SOURCE',
    };
  }

  if (items.length === 0) {
    items = [{ description: serviceDescription, amount: totalPayable }];
  }

  const remainingBalance = Math.max(
    0,
    Math.round((totalPayable - alreadyPaid - amountPaid) * 100) / 100
  );

  const branchObj = Array.isArray(tx.branches) ? tx.branches[0] : tx.branches;
  const branchName = branchObj?.name || 'Main Spa';

  const receiptData: PrintableReceiptData = {
    companyName: 'CRADLE WELLNESS LIVING INC.',
    branchName,
    transactionId: String(tx.id),
    orderNumber,
    customerName,
    customerPhone,
    formattedDateTime: new Date(String(tx.occurred_at)).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    serviceDescription,
    visitType,
    items,
    totalPayable,
    alreadyPaid,
    amountPaid,
    remainingBalance,
    payments: movements,
    isReprint: true,
    receiptLabel: 'PAYMENT ACKNOWLEDGMENT',
  };

  return {
    ok: true,
    data: receiptData,
  };
}
