import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ORDER_PAYABLE_CHARGE_TYPES,
  ORDER_PAYMENT_STATES,
  isValidOrderPayableChargeType,
  validateOrderPayableItemPayload,
  validateFinancialOrderAllocationPayload,
  deriveOrderPaymentState,
  type OrderPayableChargeType,
  type DerivedOrderPaymentState,
  type OrderPayableItemPayload,
  type FinancialOrderAllocationPayload,
} from "@/lib/cash-flow/financial-contract";

describe("CF3 — Order Payables & Financial Allocation Contract", () => {
  describe("Order Payable Charge Taxonomy", () => {
    it("defines the approved canonical payable charge types", () => {
      const expectedTypes: OrderPayableChargeType[] = [
        "service",
        "home_service_fee",
        "retail_product",
        "surcharge",
        "discount",
        "manual_adjustment",
        "other_charge",
      ];
      expect(ORDER_PAYABLE_CHARGE_TYPES).toEqual(expectedTypes);
    });

    it("accepts valid charge types via isValidOrderPayableChargeType", () => {
      for (const chargeType of ORDER_PAYABLE_CHARGE_TYPES) {
        expect(isValidOrderPayableChargeType(chargeType)).toBe(true);
      }
    });

    it("strictly excludes tips from order payable charge types", () => {
      expect(isValidOrderPayableChargeType("tip")).toBe(false);
      expect(isValidOrderPayableChargeType("tip_collected")).toBe(false);
      expect(isValidOrderPayableChargeType("therapist_tip")).toBe(false);
    });

    it("strictly excludes vouchers from order payable charge types", () => {
      expect(isValidOrderPayableChargeType("voucher")).toBe(false);
      expect(isValidOrderPayableChargeType("voucher_redemption")).toBe(false);
    });

    it("strictly excludes customer credits from order payable charge types", () => {
      expect(isValidOrderPayableChargeType("customer_credit")).toBe(false);
      expect(isValidOrderPayableChargeType("customer_credit_applied")).toBe(false);
    });
  });

  describe("Amount Sign Semantics & Validation", () => {
    const validOrderId = "11111111-1111-1111-1111-111111111111";
    const validBookingId = "22222222-2222-2222-2222-222222222222";

    it("accepts positive amounts for charges (service, home_service_fee, retail, surcharge, other)", () => {
      const charges: OrderPayableChargeType[] = [
        "service",
        "home_service_fee",
        "retail_product",
        "surcharge",
        "other_charge",
      ];

      for (const chargeType of charges) {
        const payload: OrderPayableItemPayload = {
          orderId: validOrderId,
          bookingId: chargeType === "service" ? validBookingId : undefined,
          chargeType,
          description: `Test ${chargeType}`,
          amount: 500,
        };
        expect(() => validateOrderPayableItemPayload(payload)).not.toThrow();
      }
    });

    it("rejects non-positive amounts for standard charges", () => {
      const payloadNegative: OrderPayableItemPayload = {
        orderId: validOrderId,
        bookingId: validBookingId,
        chargeType: "service",
        description: "Negative Service",
        amount: -500,
      };
      expect(() => validateOrderPayableItemPayload(payloadNegative)).toThrowError(
        /PAYABLE_INVALID_SIGN/
      );

      const payloadZero: OrderPayableItemPayload = {
        orderId: validOrderId,
        bookingId: validBookingId,
        chargeType: "service",
        description: "Zero Service",
        amount: 0,
      };
      expect(() => validateOrderPayableItemPayload(payloadZero)).toThrowError(
        /PAYABLE_ZERO_AMOUNT/
      );
    });

    it("accepts negative amounts for discounts and rejects positive/zero discounts", () => {
      const validDiscount: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "discount",
        description: "Promo Discount 10%",
        amount: -150,
      };
      expect(() => validateOrderPayableItemPayload(validDiscount)).not.toThrow();

      const positiveDiscount: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "discount",
        description: "Invalid Positive Discount",
        amount: 150,
      };
      expect(() => validateOrderPayableItemPayload(positiveDiscount)).toThrowError(
        /PAYABLE_INVALID_SIGN/
      );

      const zeroDiscount: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "discount",
        description: "Zero Discount",
        amount: 0,
      };
      expect(() => validateOrderPayableItemPayload(zeroDiscount)).toThrowError(
        /PAYABLE_ZERO_AMOUNT/
      );
    });

    it("accepts positive or negative amounts for manual adjustments but rejects zero", () => {
      const positiveAdjustment: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "manual_adjustment",
        description: "Manager Courtesy Charge",
        amount: 100,
      };
      expect(() => validateOrderPayableItemPayload(positiveAdjustment)).not.toThrow();

      const negativeAdjustment: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "manual_adjustment",
        description: "Manager Goodwill Waiver",
        amount: -100,
      };
      expect(() => validateOrderPayableItemPayload(negativeAdjustment)).not.toThrow();

      const zeroAdjustment: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "manual_adjustment",
        description: "Zero Adjustment",
        amount: 0,
      };
      expect(() => validateOrderPayableItemPayload(zeroAdjustment)).toThrowError(
        /PAYABLE_ZERO_AMOUNT/
      );
    });

    it("enforces service lines must provide bookingId", () => {
      const serviceWithoutBooking: OrderPayableItemPayload = {
        orderId: validOrderId,
        chargeType: "service",
        description: "Swedish Massage",
        amount: 800,
      };
      expect(() => validateOrderPayableItemPayload(serviceWithoutBooking)).toThrowError(
        /SERVICE_PAYABLE_REQUIRES_BOOKING/
      );

      const serviceWithBooking: OrderPayableItemPayload = {
        orderId: validOrderId,
        bookingId: validBookingId,
        chargeType: "service",
        description: "Swedish Massage",
        amount: 800,
      };
      expect(() => validateOrderPayableItemPayload(serviceWithBooking)).not.toThrow();
    });
  });

  describe("Two-Tier Financial Allocation Model", () => {
    const validMovementId = "33333333-3333-3333-3333-333333333333";
    const validOrderId = "11111111-1111-1111-1111-111111111111";
    const validPayableItemId = "44444444-4444-4444-4444-444444444444";

    it("validates Tier 1 order-level default allocation (payableItemId is null or omitted)", () => {
      const orderLevelPayload: FinancialOrderAllocationPayload = {
        financialAccountMovementId: validMovementId,
        orderId: validOrderId,
        amount: 1200,
      };
      expect(() => validateFinancialOrderAllocationPayload(orderLevelPayload)).not.toThrow();
    });

    it("validates Tier 2 item-level allocation (payableItemId is populated)", () => {
      const itemLevelPayload: FinancialOrderAllocationPayload = {
        financialAccountMovementId: validMovementId,
        orderId: validOrderId,
        payableItemId: validPayableItemId,
        amount: 600,
      };
      expect(() => validateFinancialOrderAllocationPayload(itemLevelPayload)).not.toThrow();
    });

    it("rejects non-positive allocation amounts", () => {
      const zeroAllocation: FinancialOrderAllocationPayload = {
        financialAccountMovementId: validMovementId,
        orderId: validOrderId,
        amount: 0,
      };
      expect(() => validateFinancialOrderAllocationPayload(zeroAllocation)).toThrowError(
        /ALLOCATION_NON_POSITIVE/
      );

      const negativeAllocation: FinancialOrderAllocationPayload = {
        financialAccountMovementId: validMovementId,
        orderId: validOrderId,
        amount: -500,
      };
      expect(() => validateFinancialOrderAllocationPayload(negativeAllocation)).toThrowError(
        /ALLOCATION_NON_POSITIVE/
      );
    });

    it("rejects missing movement ID or order ID", () => {
      expect(() =>
        validateFinancialOrderAllocationPayload({
          financialAccountMovementId: "",
          orderId: validOrderId,
          amount: 500,
        })
      ).toThrowError(/ALLOCATION_INVALID_PAYLOAD/);

      expect(() =>
        validateFinancialOrderAllocationPayload({
          financialAccountMovementId: validMovementId,
          orderId: "",
          amount: 500,
        })
      ).toThrowError(/ALLOCATION_INVALID_PAYLOAD/);
    });
  });

  describe("Derived Order Payment State (CF1-D07)", () => {
    it("defines the expected derived payment state taxonomy", () => {
      const expectedStates: DerivedOrderPaymentState[] = [
        "unpaid",
        "partial",
        "paid",
        "overpaid",
        "partially_refunded",
        "refunded",
        "invalid_negative_payable",
      ];
      expect(ORDER_PAYMENT_STATES).toEqual(expectedStates);
    });

    it("derives 'unpaid' when net allocated is 0 for a positive payable", () => {
      expect(deriveOrderPaymentState(1000, 0)).toBe("unpaid");
      expect(deriveOrderPaymentState(500, 0)).toBe("unpaid");
    });

    it("derives 'partial' when 0 < net allocated < total payable", () => {
      expect(deriveOrderPaymentState(1000, 200)).toBe("partial");
      expect(deriveOrderPaymentState(1000, 999.99)).toBe("partial");
    });

    it("derives 'paid' when net allocated equals total payable", () => {
      expect(deriveOrderPaymentState(1000, 1000)).toBe("paid");
      expect(deriveOrderPaymentState(750.5, 750.5)).toBe("paid");
    });

    it("derives 'overpaid' when net allocated exceeds total payable", () => {
      expect(deriveOrderPaymentState(1000, 1200)).toBe("overpaid");
      expect(deriveOrderPaymentState(1000, 1000.01)).toBe("overpaid");
    });

    it("handles zero-payable promotional orders cleanly (payable = 0, allocated = 0 -> 'paid')", () => {
      // 100% discounted or promotional order where customer owes ₱0
      expect(deriveOrderPaymentState(0, 0)).toBe("paid");
      // If customer paid money on a ₱0 order, it is overpaid
      expect(deriveOrderPaymentState(0, 50)).toBe("overpaid");
    });

    it("flags invalid net-negative payable as 'invalid_negative_payable'", () => {
      // Net-negative payable is invalid (discounts cannot exceed charges)
      expect(deriveOrderPaymentState(-100, 0)).toBe("invalid_negative_payable");
      expect(deriveOrderPaymentState(-50, 0)).toBe("invalid_negative_payable");
    });
  });

  describe("Split Payment Attribution & Double-Count Prevention", () => {
    it("supports split-payment attribution across multiple account movements", () => {
      // Example: ₱1,500 total payable settled via ₱1,000 Cash movement + ₱500 GCash movement
      const splitAllocations: FinancialOrderAllocationPayload[] = [
        {
          financialAccountMovementId: "cash-movement-uuid",
          orderId: "order-1",
          amount: 1000,
        },
        {
          financialAccountMovementId: "gcash-movement-uuid",
          orderId: "order-1",
          amount: 500,
        },
      ];

      const totalAllocated = splitAllocations.reduce((sum, a) => sum + a.amount, 0);
      expect(totalAllocated).toBe(1500);

      const derivedState = deriveOrderPaymentState(1500, totalAllocated);
      expect(derivedState).toBe("paid");
    });

    it("prevents double-counting by establishing mutually exclusive allocation scopes", () => {
      // Each allocation row is distinct. Order-level (null payableItemId) and item-level (populated)
      // represent non-duplicated movement value assignments.
      const allocations: FinancialOrderAllocationPayload[] = [
        {
          financialAccountMovementId: "mov-1",
          orderId: "order-1",
          payableItemId: null, // Order-level
          amount: 800,
        },
        {
          financialAccountMovementId: "mov-2",
          orderId: "order-1",
          payableItemId: "item-service-2", // Item-level
          amount: 400,
        },
      ];

      // Summing rows gives exactly ₱1,200 without redundant child distribution rows
      const total = allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(total).toBe(1200);
    });
  });
});
