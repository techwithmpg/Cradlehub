'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordOrderPayment, type RecordOrderPaymentResult } from './payment-writer';
import {
  PostOrderPaymentPayloadSchema,
  type PostOrderPaymentPayload,
} from './financial-contract';

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
    revalidatePath('/crm/cash-flow');
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
