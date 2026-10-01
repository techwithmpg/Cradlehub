import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  PostOrderPaymentPayloadSchema,
  PaymentPartPayloadSchema,
  PaymentAllocationPayloadSchema,
  isPaymentMethodCompatibleWithAccount,
  deriveOrderPaymentState,
  type PostOrderPaymentPayload,
} from '@/lib/cash-flow/financial-contract';
import { recordOrderPayment } from '@/lib/cash-flow/payment-writer';

describe('CF4: Payment Writer Contract & Validation', () => {
  const validOrderId = '11111111-1111-1111-1111-111111111111';
  const validAccountId1 = '22222222-2222-2222-2222-222222222222';
  const validAccountId2 = '33333333-3333-3333-3333-333333333333';
  const validPayableItemId1 = '44444444-4444-4444-4444-444444444444';
  const validPayableItemId2 = '55555555-5555-5555-5555-555555555555';

  describe('PaymentPartPayloadSchema', () => {
    it('accepts valid cash payment part', () => {
      const part = {
        amount: 1500,
        paymentMethod: 'cash',
        financialAccountId: validAccountId1,
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(true);
    });

    it('accepts valid gcash payment part with external reference', () => {
      const part = {
        amount: 500.5,
        paymentMethod: 'gcash',
        financialAccountId: validAccountId2,
        externalReference: 'GCASH-998877',
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(true);
    });

    it('rejects zero amount', () => {
      const part = {
        amount: 0,
        paymentMethod: 'cash',
        financialAccountId: validAccountId1,
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('greater than zero');
      }
    });

    it('rejects negative amount', () => {
      const part = {
        amount: -250,
        paymentMethod: 'cash',
        financialAccountId: validAccountId1,
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(false);
    });

    it('rejects amount with more than 2 decimal places', () => {
      const part = {
        amount: 100.555,
        paymentMethod: 'cash',
        financialAccountId: validAccountId1,
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('2 decimal places');
      }
    });

    it('rejects unsupported payment method', () => {
      const part = {
        amount: 500,
        paymentMethod: 'crypto',
        financialAccountId: validAccountId1,
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(false);
    });

    it('rejects invalid financial account UUID', () => {
      const part = {
        amount: 500,
        paymentMethod: 'cash',
        financialAccountId: 'not-a-uuid',
      };
      const parsed = PaymentPartPayloadSchema.safeParse(part);
      expect(parsed.success).toBe(false);
    });
  });

  describe('PaymentAllocationPayloadSchema', () => {
    it('accepts valid item allocation', () => {
      const alloc = {
        payableItemId: validPayableItemId1,
        amount: 1200,
      };
      const parsed = PaymentAllocationPayloadSchema.safeParse(alloc);
      expect(parsed.success).toBe(true);
    });

    it('rejects zero or negative allocation amount', () => {
      const parsedZero = PaymentAllocationPayloadSchema.safeParse({
        payableItemId: validPayableItemId1,
        amount: 0,
      });
      expect(parsedZero.success).toBe(false);

      const parsedNeg = PaymentAllocationPayloadSchema.safeParse({
        payableItemId: validPayableItemId1,
        amount: -50,
      });
      expect(parsedNeg.success).toBe(false);
    });
  });

  describe('PostOrderPaymentPayloadSchema', () => {
    it('accepts full payment command with order-level default allocation', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-full-001',
        payments: [
          {
            amount: 1500,
            paymentMethod: 'cash' as const,
            financialAccountId: validAccountId1,
          },
        ],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('accepts split-tender payment command', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-split-001',
        payments: [
          {
            amount: 1000,
            paymentMethod: 'cash' as const,
            financialAccountId: validAccountId1,
          },
          {
            amount: 500,
            paymentMethod: 'gcash' as const,
            financialAccountId: validAccountId2,
            externalReference: 'REF-1234',
          },
        ],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('accepts explicit item-level allocations when sum matches total payment', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-alloc-001',
        payments: [
          {
            amount: 1500,
            paymentMethod: 'cash' as const,
            financialAccountId: validAccountId1,
          },
        ],
        allocations: [
          { payableItemId: validPayableItemId1, amount: 1200 },
          { payableItemId: validPayableItemId2, amount: 300 },
        ],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('rejects explicit item-level allocations when sum mismatches payment total', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-mismatch-001',
        payments: [
          {
            amount: 1500,
            paymentMethod: 'cash' as const,
            financialAccountId: validAccountId1,
          },
        ],
        allocations: [
          { payableItemId: validPayableItemId1, amount: 1000 },
          // Total allocated is 1000, but payment is 1500
        ],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(
          'Sum of explicit item allocations must exactly equal total payment amount'
        );
      }
    });

    it('rejects empty payments array', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-empty-001',
        payments: [],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('rejects empty idempotency key', () => {
      const payload = {
        orderId: validOrderId,
        idempotencyKey: '   ',
        payments: [
          {
            amount: 500,
            paymentMethod: 'cash' as const,
            financialAccountId: validAccountId1,
          },
        ],
      };
      const parsed = PostOrderPaymentPayloadSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('isPaymentMethodCompatibleWithAccount', () => {
    it('validates matching pairs', () => {
      expect(isPaymentMethodCompatibleWithAccount('cash', 'cash_drawer')).toBe(true);
      expect(isPaymentMethodCompatibleWithAccount('gcash', 'gcash')).toBe(true);
      expect(isPaymentMethodCompatibleWithAccount('maya', 'maya')).toBe(true);
      expect(isPaymentMethodCompatibleWithAccount('bank_transfer', 'bank_transfer')).toBe(true);
      expect(isPaymentMethodCompatibleWithAccount('card', 'card_terminal')).toBe(true);
    });

    it('rejects mismatched pairs', () => {
      expect(isPaymentMethodCompatibleWithAccount('gcash', 'cash_drawer')).toBe(false);
      expect(isPaymentMethodCompatibleWithAccount('cash', 'gcash')).toBe(false);
      expect(isPaymentMethodCompatibleWithAccount('card', 'maya')).toBe(false);
    });
  });

  describe('Derived Payment State Semantics for Payment Amounts', () => {
    it('derives paid when payment equals payable', () => {
      expect(deriveOrderPaymentState(1500, 1500)).toBe('paid');
    });

    it('derives partial when payment is less than payable', () => {
      expect(deriveOrderPaymentState(1500, 500)).toBe('partial');
    });

    it('derives overpaid when net allocated exceeds payable', () => {
      expect(deriveOrderPaymentState(1500, 1700)).toBe('overpaid');
    });

    it('derives unpaid when zero is allocated', () => {
      expect(deriveOrderPaymentState(1500, 0)).toBe('unpaid');
    });

    it('derives paid for promotional zero-payable order with 0 allocated', () => {
      expect(deriveOrderPaymentState(0, 0)).toBe('paid');
    });

    it('derives invalid_negative_payable for negative payable orders', () => {
      expect(deriveOrderPaymentState(-100, 0)).toBe('invalid_negative_payable');
    });
  });

  describe('Server Adapter: recordOrderPayment', () => {
    it('returns validation error without calling RPC on malformed payload', async () => {
      const mockClient = { rpc: vi.fn() };
      const invalidPayload = {
        orderId: 'invalid-uuid',
        idempotencyKey: '',
        payments: [],
      } as unknown as PostOrderPaymentPayload;

      const result = await recordOrderPayment(mockClient, invalidPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('VALIDATION_FAILED');
      }
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it('calls RPC with formatted arguments and returns structured success result', async () => {
      const mockRpcResponse = {
        success: true,
        is_idempotent_replay: false,
        transaction_id: 'tx-11111111-1111-1111-1111-111111111111',
        order_id: validOrderId,
        branch_id: 'br-11111111-1111-1111-1111-111111111111',
        business_date: '2026-09-27',
        total_paid: 1500,
        total_payable: 1500,
        net_allocated: 1500,
        remaining_balance: 0,
        payment_state: 'paid',
        movements: [
          {
            id: 'mov-1',
            financial_account_id: validAccountId1,
            amount: 1000,
            payment_method: 'cash',
            external_reference: null,
          },
          {
            id: 'mov-2',
            financial_account_id: validAccountId2,
            amount: 500,
            payment_method: 'gcash',
            external_reference: 'GCASH-77',
          },
        ],
        allocations: [
          {
            id: 'alloc-1',
            financial_account_movement_id: 'mov-1',
            payable_item_id: null,
            amount: 1000,
          },
          {
            id: 'alloc-2',
            financial_account_movement_id: 'mov-2',
            payable_item_id: null,
            amount: 500,
          },
        ],
      };

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockRpcResponse, error: null }),
      };

      const validPayload: PostOrderPaymentPayload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-test-99',
        payments: [
          {
            amount: 1000,
            paymentMethod: 'cash',
            financialAccountId: validAccountId1,
          },
          {
            amount: 500,
            paymentMethod: 'gcash',
            financialAccountId: validAccountId2,
            externalReference: 'GCASH-77',
          },
        ],
      };

      const result = await recordOrderPayment(mockClient, validPayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.totalPaid).toBe(1500);
        expect(result.data.paymentState).toBe('paid');
        expect(result.data.movements).toHaveLength(2);
        expect(result.data.allocations).toHaveLength(2);
      }

      expect(mockClient.rpc).toHaveBeenCalledWith('post_order_payment_atomic', {
        p_order_id: validOrderId,
        p_idempotency_key: 'idem-test-99',
        p_payments: [
          {
            amount: 1000,
            payment_method: 'cash',
            financial_account_id: validAccountId1,
            external_reference: null,
          },
          {
            amount: 500,
            payment_method: 'gcash',
            financial_account_id: validAccountId2,
            external_reference: 'GCASH-77',
          },
        ],
        p_allocations: null,
        p_business_date: null,
        p_external_reference: null,
        p_notes: null,
      });
    });

    it('returns error when RPC returns database error', async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'PAYMENT_EXCEEDS_REMAINING_BALANCE', code: 'P0001' },
        }),
      };

      const payload: PostOrderPaymentPayload = {
        orderId: validOrderId,
        idempotencyKey: 'idem-fail-01',
        payments: [
          {
            amount: 5000,
            paymentMethod: 'cash',
            financialAccountId: validAccountId1,
          },
        ],
      };

      const result = await recordOrderPayment(mockClient, payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('PAYMENT_EXCEEDS_REMAINING_BALANCE');
      }
    });
  });
});
