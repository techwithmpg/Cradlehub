import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FINANCIAL_ACCOUNT_TYPES,
  FINANCIAL_TRANSACTION_TYPES,
  FINANCIAL_PAYMENT_RAILS,
  CF2_SUPPORTED_CURRENCIES,
  isValidPaymentMethod,
  assertValidMovementAmount,
  calculateNetMovement,
  assertValidReversal,
  maskAccountIdentifier,
  validateFinancialMovementPayload,
  validateFinancialTransactionPayload,
  type FinancialAccountType,
  type FinancialTransactionType,
  type FinancialPaymentRail,
  type FinancialMovementPayload,
  type FinancialTransactionPayload,
} from "@/lib/cash-flow/financial-contract";

describe("CF2 — Financial Foundation Contract & Invariants", () => {
  describe("Financial Account Taxonomy", () => {
    it("defines the frozen canonical financial account types", () => {
      const expectedTypes: FinancialAccountType[] = [
        "cash_drawer",
        "gcash",
        "maya",
        "bank_transfer",
        "card_terminal",
      ];
      expect(FINANCIAL_ACCOUNT_TYPES).toEqual(expectedTypes);
    });

    it("verifies PHP as the default supported CF2 currency", () => {
      expect(CF2_SUPPORTED_CURRENCIES).toContain("PHP");
      expect(CF2_SUPPORTED_CURRENCIES).toHaveLength(1);
    });

    it("masks sensitive account identifiers cleanly without exposing secret numbers", () => {
      expect(maskAccountIdentifier(null)).toBeNull();
      expect(maskAccountIdentifier("")).toBeNull();
      expect(maskAccountIdentifier("123")).toBe("•••• 123");
      expect(maskAccountIdentifier("09171234567")).toBe("•••• 4567");
      expect(maskAccountIdentifier("1234-5678-9012")).toBe("•••• 9012");
    });
  });

  describe("Movement Payment Rail Taxonomy (Money Rails Only)", () => {
    it("defines the frozen canonical account-moving payment rails", () => {
      const expectedRails: FinancialPaymentRail[] = [
        "cash",
        "gcash",
        "maya",
        "bank_transfer",
        "card",
      ];
      expect(FINANCIAL_PAYMENT_RAILS).toEqual(expectedRails);
    });

    it("accepts valid money rails as payment methods", () => {
      expect(isValidPaymentMethod("cash")).toBe(true);
      expect(isValidPaymentMethod("gcash")).toBe(true);
      expect(isValidPaymentMethod("maya")).toBe(true);
      expect(isValidPaymentMethod("bank_transfer")).toBe(true);
      expect(isValidPaymentMethod("card")).toBe(true);
    });

    it("strictly rejects voucher and customer_credit from account movements", () => {
      expect(isValidPaymentMethod("voucher")).toBe(false);
      expect(isValidPaymentMethod("customer_credit")).toBe(false);
      expect((FINANCIAL_PAYMENT_RAILS as readonly string[]).includes("voucher")).toBe(false);
      expect((FINANCIAL_PAYMENT_RAILS as readonly string[]).includes("customer_credit")).toBe(false);
    });

    it("rejects non-money rail paymentMethod in movement payload validation", () => {
      expect(() =>
        validateFinancialMovementPayload({
          transactionId: "10000000-0000-0000-0000-000000000001",
          accountId: "20000000-0000-0000-0000-000000000001",
          amount: 500,
          paymentMethod: "voucher" as unknown as FinancialPaymentRail,
        })
      ).toThrow(/Invalid payment method rail: voucher/);

      expect(() =>
        validateFinancialMovementPayload({
          transactionId: "10000000-0000-0000-0000-000000000001",
          accountId: "20000000-0000-0000-0000-000000000001",
          amount: 500,
          paymentMethod: "customer_credit" as unknown as FinancialPaymentRail,
        })
      ).toThrow(/Invalid payment method rail: customer_credit/);
    });
  });

  describe("Signed Movement Semantics (CF1-D03)", () => {
    it("accepts strictly positive movement amounts (money entering account)", () => {
      expect(() => assertValidMovementAmount(100)).not.toThrow();
      expect(() => assertValidMovementAmount(0.01)).not.toThrow();
      expect(() => assertValidMovementAmount(1500.5)).not.toThrow();
    });

    it("accepts strictly negative movement amounts (money leaving account)", () => {
      expect(() => assertValidMovementAmount(-50)).not.toThrow();
      expect(() => assertValidMovementAmount(-0.01)).not.toThrow();
      expect(() => assertValidMovementAmount(-5000)).not.toThrow();
    });

    it("strictly rejects zero movement amount with an invariant violation", () => {
      expect(() => assertValidMovementAmount(0)).toThrow(
        /FINANCIAL_INVALID_AMOUNT: Account movement amount cannot be zero/
      );
      expect(() => assertValidMovementAmount(-0)).toThrow(
        /FINANCIAL_INVALID_AMOUNT: Account movement amount cannot be zero/
      );
    });

    it("strictly rejects non-finite or NaN movement amounts", () => {
      expect(() => assertValidMovementAmount(NaN)).toThrow(
        /FINANCIAL_INVALID_AMOUNT: Account movement amount cannot be zero/
      );
    });

    it("calculates net balance movement across multiple accounts under a transaction", () => {
      const movements: FinancialMovementPayload[] = [
        {
          transactionId: "tx-1",
          accountId: "acc-cash",
          amount: 1000,
          currency: "PHP",
          movementIndex: 0,
        },
        {
          transactionId: "tx-1",
          accountId: "acc-gcash",
          amount: 500,
          currency: "PHP",
          movementIndex: 1,
        },
      ];
      expect(calculateNetMovement(movements)).toBe(1500);

      const transferMovements: FinancialMovementPayload[] = [
        {
          transactionId: "tx-2",
          accountId: "acc-cash",
          amount: -5000,
          currency: "PHP",
          movementIndex: 0,
        },
        {
          transactionId: "tx-2",
          accountId: "acc-bank",
          amount: 5000,
          currency: "PHP",
          movementIndex: 1,
        },
      ];
      expect(calculateNetMovement(transferMovements)).toBe(0);
    });

    it("rejects mixed currency in net movement calculation", () => {
      const mixedMovements: FinancialMovementPayload[] = [
        {
          transactionId: "tx-1",
          accountId: "acc-cash",
          amount: 1000,
          currency: "PHP",
          movementIndex: 0,
        },
        {
          transactionId: "tx-1",
          accountId: "acc-bank",
          amount: 20,
          currency: "USD",
          movementIndex: 1,
        },
      ];
      expect(() => calculateNetMovement(mixedMovements)).toThrow(
        /Multi-currency movements under a single transaction are not supported/
      );
    });
  });

  describe("Multiple Movements per Transaction Contract", () => {
    it("validates valid movement payload structure", () => {
      const payload: FinancialMovementPayload = {
        transactionId: "10000000-0000-0000-0000-000000000001",
        accountId: "20000000-0000-0000-0000-000000000001",
        amount: 850.5,
        currency: "PHP",
        movementIndex: 0,
        notes: "Split payment cash component",
      };
      expect(() => validateFinancialMovementPayload(payload)).not.toThrow();
    });

    it("rejects movement with empty transaction or account ID", () => {
      expect(() =>
        validateFinancialMovementPayload({
          transactionId: "",
          accountId: "20000000-0000-0000-0000-000000000001",
          amount: 100,
          currency: "PHP",
          movementIndex: 0,
        })
      ).toThrow(/transactionId is required/);

      expect(() =>
        validateFinancialMovementPayload({
          transactionId: "10000000-0000-0000-0000-000000000001",
          accountId: "   ",
          amount: 100,
          currency: "PHP",
          movementIndex: 0,
        })
      ).toThrow(/accountId is required/);
    });

    it("rejects negative movement indices", () => {
      expect(() =>
        validateFinancialMovementPayload({
          transactionId: "10000000-0000-0000-0000-000000000001",
          accountId: "20000000-0000-0000-0000-000000000001",
          amount: 100,
          currency: "PHP",
          movementIndex: -1,
        })
      ).toThrow(/movementIndex must be a non-negative integer/);
    });
  });

  describe("Transaction Taxonomy and Source Contracts", () => {
    it("contains all authorized CF1 transaction types", () => {
      const expectedTypes: FinancialTransactionType[] = [
        "customer_payment",
        "customer_refund",
        "customer_deposit",
        "operational_expense",
        "cash_adjustment",
        "tip_collection",
        "tip_disbursement",
        "payroll_disbursement",
        "voucher_sale",
        "voucher_redemption",
        "retail_sale",
        "other_income",
      ];
      expect(FINANCIAL_TRANSACTION_TYPES).toEqual(expectedTypes);
    });

    it("validates complete canonical transaction payload", () => {
      const payload: FinancialTransactionPayload = {
        branchId: "branch-uuid-1",
        businessDate: "2026-09-27",
        occurredAt: "2026-09-27T14:00:00Z",
        transactionType: "customer_payment",
        idempotencyKey: "branch-uuid-1:booking-order:order-123:customer_payment",
        sourceType: "booking_order",
        sourceId: "order-123",
        externalReference: "GCASH-REF-998877",
        recordedBy: "staff-uuid-1",
      };
      expect(() => validateFinancialTransactionPayload(payload)).not.toThrow();
    });

    it("rejects transaction with invalid business date format", () => {
      const payload: FinancialTransactionPayload = {
        branchId: "branch-uuid-1",
        businessDate: "27-09-2026",
        occurredAt: "2026-09-27T14:00:00Z",
        transactionType: "customer_payment",
        idempotencyKey: "key-1",
      };
      expect(() => validateFinancialTransactionPayload(payload)).toThrow(
        /businessDate must follow YYYY-MM-DD format/
      );
    });

    it("rejects transaction with empty idempotency key", () => {
      const payload: FinancialTransactionPayload = {
        branchId: "branch-uuid-1",
        businessDate: "2026-09-27",
        occurredAt: "2026-09-27T14:00:00Z",
        transactionType: "customer_payment",
        idempotencyKey: "   ",
      };
      expect(() => validateFinancialTransactionPayload(payload)).toThrow(
        /idempotencyKey is required/
      );
    });
  });

  describe("Reversal Relationship Contract (CF1-D13)", () => {
    it("allows valid reversal of an existing original transaction", () => {
      expect(() =>
        assertValidReversal("tx-original-123", "tx-reversal-456")
      ).not.toThrow();
    });

    it("strictly prevents self-reversal where transaction id equals reversal target id", () => {
      expect(() =>
        assertValidReversal("tx-same-id", "tx-same-id")
      ).toThrow(/A financial transaction cannot reverse itself/);
    });
  });
});
