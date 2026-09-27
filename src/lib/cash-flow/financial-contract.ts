/**
 * CF2: Financial Accounts + Canonical Transaction & Movement Foundation
 * Authoritative Domain Contract & Invariants
 *
 * Grounded in: CradleHub_CF1_Financial_Contract_Freeze.md
 * Stage: CF2 — FINANCIAL ACCOUNTS + CANONICAL TRANSACTION FOUNDATION
 */

export const FINANCIAL_ACCOUNT_TYPES = [
  'cash_drawer',
  'gcash',
  'maya',
  'bank_transfer',
  'card_terminal',
] as const;

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const FINANCIAL_TRANSACTION_TYPES = [
  'customer_payment',
  'customer_refund',
  'customer_deposit',
  'operational_expense',
  'cash_adjustment',
  'tip_collection',
  'tip_disbursement',
  'payroll_disbursement',
  'voucher_sale',
  'voucher_redemption',
  'retail_sale',
  'other_income',
] as const;

export type FinancialTransactionType = (typeof FINANCIAL_TRANSACTION_TYPES)[number];

export const FINANCIAL_PAYMENT_RAILS = [
  'cash',
  'gcash',
  'maya',
  'bank_transfer',
  'card',
  'voucher',
  'customer_credit',
] as const;

export type FinancialPaymentRail = (typeof FINANCIAL_PAYMENT_RAILS)[number];

export const FINANCIAL_TRANSACTION_STATUSES = ['posted', 'reversed', 'voided'] as const;
export type FinancialTransactionStatus = (typeof FINANCIAL_TRANSACTION_STATUSES)[number];

export const FINANCIAL_TRANSACTION_SOURCE_TYPES = [
  'booking_order',
  'cash_session',
  'payroll_run',
  'retail_sale',
  'legacy_booking',
] as const;

export type FinancialTransactionSourceType = (typeof FINANCIAL_TRANSACTION_SOURCE_TYPES)[number];

/**
 * Financial Account (Relational Catalog Representation)
 */
export interface FinancialAccount {
  id: string; // UUID primary key
  branchId: string | null; // Nullable for corporate/HQ level accounts
  name: string; // e.g. "Main Cash Drawer", "Front Desk GCash #1"
  accountType: FinancialAccountType;
  identifierMask: string; // Safe display mask (e.g. "*1234", "0917-***-5678")
  currency: 'PHP';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Masked Account Representation for Front Desk/CRM
 */
export interface MaskedFinancialAccount {
  id: string;
  branchId: string | null;
  name: string;
  accountType: FinancialAccountType;
  identifierMask: string;
  currency: 'PHP';
  isActive: boolean;
  createdAt: string;
}

/**
 * Canonical Financial Transaction (Single Event Identity Header)
 * Note: Stores identity, business date, and context.
 * Does NOT store an authoritative mutable monetary amount.
 */
export interface FinancialTransaction {
  id: string; // UUID primary key
  branchId: string; // UUID references branches(id)
  transactionType: FinancialTransactionType;
  businessDate: string; // YYYY-MM-DD operating business date
  occurredAt: string; // ISO 8601 wall-clock timestamp
  recordedAt: string; // ISO 8601 database commit timestamp
  recordedBy: string; // UUID references staff(id)
  currency: 'PHP';
  status: FinancialTransactionStatus;
  idempotencyKey: string; // Unique idempotency key for replay suppression
  sourceType?: FinancialTransactionSourceType | null;
  sourceId?: string | null;
  externalReference?: string | null;
  reversalOfTransactionId?: string | null; // Self-referencing link for reversals
  notes?: string | null;
  createdAt: string;
}

/**
 * Financial Account Movement (Authoritative Signed Monetary Action)
 * Signed convention:
 *   amount > 0: Money ENTERS account (inflow)
 *   amount < 0: Money LEAVES account (outflow)
 *   amount = 0: STRICTLY INVALID
 */
export interface FinancialAccountMovement {
  id: string; // UUID primary key
  transactionId: string; // UUID references financial_transactions(id)
  financialAccountId: string; // UUID references financial_accounts(id)
  amount: number; // Signed NUMERIC(12,2)
  paymentMethod: FinancialPaymentRail;
  externalReference?: string | null;
  createdAt: string;
}

/**
 * CF1-D03: Signed Movement Validation Helpers
 */
export function assertNonZeroMovement(amount: number): void {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0) {
    throw new Error('FINANCIAL_INVALID_AMOUNT: Account movement amount cannot be zero.');
  }
}

export function getMovementDirection(amount: number): 'inflow' | 'outflow' {
  assertNonZeroMovement(amount);
  return amount > 0 ? 'inflow' : 'outflow';
}

export function assertNoSelfReversal(
  transactionId: string,
  reversalOfTransactionId: string | null | undefined
): void {
  if (reversalOfTransactionId && transactionId === reversalOfTransactionId) {
    throw new Error('FINANCIAL_SELF_REVERSAL: A transaction cannot reverse itself.');
  }
}

export function isValidAccountType(value: string): value is FinancialAccountType {
  return (FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isValidTransactionType(value: string): value is FinancialTransactionType {
  return (FINANCIAL_TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function isValidPaymentMethod(value: string): value is FinancialPaymentRail {
  return (FINANCIAL_PAYMENT_RAILS as readonly string[]).includes(value);
}

export const CF2_SUPPORTED_CURRENCIES = ['PHP'] as const;
export type CF2Currency = (typeof CF2_SUPPORTED_CURRENCIES)[number];

export function maskAccountIdentifier(identifier: string | null | undefined): string | null {
  if (!identifier || identifier.trim() === '') {
    return null;
  }
  const trimmed = identifier.trim();
  const visible = trimmed.slice(-4);
  return `•••• ${visible}`;
}

export function calculateNetMovement(
  movements: Array<{ amount: number; currency?: string }>
): number {
  let net = 0;
  for (const m of movements) {
    if (m.currency && m.currency !== 'PHP') {
      throw new Error(
        'FINANCIAL_CURRENCY_MISMATCH: Multi-currency movements under a single transaction are not supported in CF2.'
      );
    }
    assertNonZeroMovement(m.amount);
    net += m.amount;
  }
  return Math.round(net * 100) / 100;
}

export interface FinancialMovementPayload {
  transactionId: string;
  accountId: string;
  amount: number;
  paymentMethod?: FinancialPaymentRail;
  currency?: string;
  movementIndex?: number;
  notes?: string;
}

export function validateFinancialMovementPayload(payload: FinancialMovementPayload): void {
  if (!payload.transactionId || payload.transactionId.trim() === '') {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: transactionId is required.');
  }
  if (!payload.accountId || payload.accountId.trim() === '') {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: accountId is required.');
  }
  assertNonZeroMovement(payload.amount);
  if (
    payload.movementIndex !== undefined &&
    (!Number.isInteger(payload.movementIndex) || payload.movementIndex < 0)
  ) {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: movementIndex must be a non-negative integer.');
  }
}

export interface FinancialTransactionPayload {
  branchId: string;
  businessDate: string;
  occurredAt: string;
  transactionType: FinancialTransactionType;
  idempotencyKey: string;
  sourceType?: FinancialTransactionSourceType | null;
  sourceId?: string | null;
  externalReference?: string | null;
  recordedBy?: string;
}

export function validateFinancialTransactionPayload(payload: FinancialTransactionPayload): void {
  if (!payload.branchId || payload.branchId.trim() === '') {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: branchId is required.');
  }
  if (!payload.businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.businessDate)) {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: businessDate must follow YYYY-MM-DD format.');
  }
  if (!payload.idempotencyKey || payload.idempotencyKey.trim() === '') {
    throw new Error('FINANCIAL_INVALID_PAYLOAD: idempotencyKey is required.');
  }
  if (!isValidTransactionType(payload.transactionType)) {
    throw new Error(`FINANCIAL_INVALID_PAYLOAD: Unknown transaction type: ${payload.transactionType}`);
  }
}

export const assertValidMovementAmount = assertNonZeroMovement;
export function assertValidReversal(originalId: string, candidateReversalId: string): void {
  if (originalId === candidateReversalId) {
    throw new Error('FINANCIAL_SELF_REVERSAL: A financial transaction cannot reverse itself.');
  }
}


