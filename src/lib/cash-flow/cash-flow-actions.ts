'use server';

import { revalidatePath } from 'next/cache';
import { revalidateOperationalBookingSurfaces } from '@/lib/bookings/revalidate-booking-surfaces';
import { createClient } from '@/lib/supabase/server';
import { recordOrderPayment, type RecordOrderPaymentResult } from './payment-writer';
import {
  PostOrderPaymentPayloadSchema,
  type PostOrderPaymentPayload,
} from './financial-contract';
import type {
  OpenCashSessionInput,
  OpenCashSessionResult,
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

  // 3. Delegate to canonical CF4 atomic payment writer
  const result = await recordOrderPayment(supabase, parsed.data);

  if (result.ok) {
    revalidateOperationalBookingSurfaces(result.data.branchId);
  }

  return result;
}

export async function recordExpenseAction(
  input: import('./cash-flow-types').RecordExpenseInput
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

  const { data, error } = await (supabase as unknown as GenericRpcClient).rpc('post_expense_atomic', {
    p_branch_id: input.branchId || null,
    p_idempotency_key: input.idempotencyKey || null,
    p_amount: input.amount,
    p_category_id: input.categoryId,
    p_financial_account_id: input.financialAccountId,
    p_payee: input.payee || 'Direct Vendor',
    p_description: input.description.trim(),
    p_receipt_reference: input.receiptReference || null,
    p_business_date: input.businessDate || null,
    p_notes: input.notes || null,
    p_receipt_image_path: input.receiptImagePath?.trim() || null,
  });

  if (error) {
    return { ok: false, error: error.message, code: error.code || 'RPC_ERROR' };
  }

  revalidatePath('/crm/cash-flow');
  return {
    ok: true,
    transactionId: (data as { transactionId?: string })?.transactionId,
    idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay,
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

  revalidatePath('/crm/cash-flow');
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
    revalidatePath('/crm/cash-flow');
    return { ok: true, transactionId: (data as { transactionId?: string })?.transactionId, idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay };
  }

  if (input.entryType === 'cash_addition' || input.entryType === 'cash_removal') {
    if (!input.cashDrawerId) {
      return { ok: false, error: 'ACCOUNT_REQUIRED: Cash drawer is required.', code: 'ACCOUNT_REQUIRED' };
    }
    if (!input.adjustmentReason || !input.adjustmentReason.trim()) {
      return { ok: false, error: 'REASON_REQUIRED: Reason for adjustment is required.', code: 'REASON_REQUIRED' };
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
    revalidatePath('/crm/cash-flow');
    return { ok: true, transactionId: (data as { transactionId?: string })?.transactionId, idempotentReplay: (data as { idempotentReplay?: boolean })?.idempotentReplay };
  }

  if (input.entryType === 'transfer') {
    if (!input.sourceAccountId || !input.destinationAccountId) {
      return { ok: false, error: 'ACCOUNTS_REQUIRED: Both source and destination accounts are required.', code: 'ACCOUNTS_REQUIRED' };
    }
    if (input.sourceAccountId === input.destinationAccountId) {
      return { ok: false, error: 'IDENTICAL_ACCOUNTS: Source and destination accounts cannot be identical.', code: 'IDENTICAL_ACCOUNTS' };
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
    revalidatePath('/crm/cash-flow');
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
  revalidatePath('/crm/cash-flow');

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
