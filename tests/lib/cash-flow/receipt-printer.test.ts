/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  buildThermalReceiptHtml,
  buildThermalReceiptText,
  formatReceiptPeso,
  isValidAuthoritativeTransactionId,
  printThermalReceipt,
  type PrintableReceiptData,
} from "../../../src/lib/cash-flow/receipt-printer";

const mockSampleReceipt: PrintableReceiptData = {
  companyName: "CRADLE WELLNESS LIVING INC.",
  branchName: "Main Spa Branch",
  transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6801",
  orderNumber: "ORDER-c5cc08fd",
  customerName: "DAWN NAVARRO",
  customerPhone: "09171234567",
  formattedDateTime: "Oct 30, 2026, 03:00 PM",
  serviceDescription: "Post Natal Massage",
  visitType: "home_service",
  items: [
    { description: "Post Natal Massage", amount: 800 },
    { description: "Home Service travel", amount: 286 },
  ],
  totalPayable: 1086,
  alreadyPaid: 0,
  amountPaid: 1086,
  remainingBalance: 0,
  payments: [
    {
      method: "Cash",
      amount: 1086,
      cashReceived: 1500,
      change: 414,
    },
  ],
  totalCashReceived: 1500,
  changeGiven: 414,
  cashierName: "Front Desk Staff",
};

describe("Thermal Receipt Printing Subsystem", () => {
  describe("isValidAuthoritativeTransactionId", () => {
    it("accepts valid standard RFC 4122 UUIDs", () => {
      expect(isValidAuthoritativeTransactionId("c5cc08fd-9912-4f32-8ea3-289b41dc6801")).toBe(true);
      expect(isValidAuthoritativeTransactionId("018d4e7f-7a2e-7111-9234-56789abcdef0")).toBe(true);
    });

    it("rejects nil UUID", () => {
      expect(isValidAuthoritativeTransactionId("00000000-0000-0000-0000-000000000000")).toBe(false);
    });

    it("rejects stringified null and undefined sentinels", () => {
      expect(isValidAuthoritativeTransactionId("null")).toBe(false);
      expect(isValidAuthoritativeTransactionId("undefined")).toBe(false);
      expect(isValidAuthoritativeTransactionId("none")).toBe(false);
      expect(isValidAuthoritativeTransactionId("n/a")).toBe(false);
      expect(isValidAuthoritativeTransactionId("unknown")).toBe(false);
      expect(isValidAuthoritativeTransactionId("[object Object]")).toBe(false);
    });

    it("rejects fabricated and mock prefixes", () => {
      expect(isValidAuthoritativeTransactionId("TXN-c5cc08fd-9912")).toBe(false);
      expect(isValidAuthoritativeTransactionId("MOCK-1234-5678")).toBe(false);
      expect(isValidAuthoritativeTransactionId("temp-c5cc08fd")).toBe(false);
      expect(isValidAuthoritativeTransactionId("fake-uuid-123")).toBe(false);
    });

    it("rejects non-string or whitespace-only inputs", () => {
      expect(isValidAuthoritativeTransactionId(null)).toBe(false);
      expect(isValidAuthoritativeTransactionId(undefined)).toBe(false);
      expect(isValidAuthoritativeTransactionId("")).toBe(false);
      expect(isValidAuthoritativeTransactionId("   ")).toBe(false);
      expect(isValidAuthoritativeTransactionId(12345)).toBe(false);
    });
  });

  describe("Formatting & HTML rendering", () => {
    it("formats Philippine peso correctly with 2 decimal places", () => {
      expect(formatReceiptPeso(1086)).toBe("₱1,086.00");
      expect(formatReceiptPeso(414)).toBe("₱414.00");
      expect(formatReceiptPeso(0)).toBe("₱0.00");
    });

    it("generates 80mm thermal receipt HTML with all required compliance fields", () => {
      const html = buildThermalReceiptHtml(mockSampleReceipt);

      // Business identity
      expect(html).toContain("CRADLE WELLNESS LIVING INC.");
      expect(html).toContain("Main Spa Branch");

      // Identifiers
      expect(html).toContain("ORDER-c5cc08fd");
      expect(html).toContain("c5cc08fd-9912-4f32-8ea3-289b41dc6801");
      expect(html).toContain("DAWN NAVARRO");
      expect(html).toContain("09171234567");

      // Line items including home service travel
      expect(html).toContain("Post Natal Massage");
      expect(html).toContain("Home Service travel");
      expect(html).toContain("₱800.00");
      expect(html).toContain("₱286.00");

      // Amounts
      expect(html).toContain("₱1,086.00");
      expect(html).toContain("Amount Paid Now");

      // Cash and Change calculations
      expect(html).toContain("Physical Cash Received");
      expect(html).toContain("₱1,500.00");
      expect(html).toContain("Change Given");
      expect(html).toContain("₱414.00");

      // Legal / Receipt disclaimer
      expect(html).toContain("PAYMENT ACKNOWLEDGMENT");
      expect(html).toContain("Supplementary payment record only.");
      expect(html).toContain("Not a BIR-registered invoice.");
    });

    it("renders idempotent replay notice in HTML and text when isIdempotentReplay is true", () => {
      const replayedReceipt: PrintableReceiptData = {
        ...mockSampleReceipt,
        isIdempotentReplay: true,
      };
      const html = buildThermalReceiptHtml(replayedReceipt);
      expect(html).toContain("PREVIOUSLY RECORDED PAYMENT");
      expect(html).toContain("Idempotent Replay Confirmation");

      const text = buildThermalReceiptText(replayedReceipt);
      expect(text).toContain("PREVIOUSLY RECORDED PAYMENT");
    });

    it("generates clean text receipt for split payments", () => {
      const splitReceipt: PrintableReceiptData = {
        ...mockSampleReceipt,
        payments: [
          { method: "GCash", amount: 500, reference: "GC-987654" },
          { method: "Cash", amount: 586, cashReceived: 1000, change: 414 },
        ],
        totalCashReceived: 1000,
        changeGiven: 414,
      };

      const text = buildThermalReceiptText(splitReceipt);
      expect(text).toContain("CRADLE WELLNESS LIVING INC.");
      expect(text).toContain("GCash");
      expect(text).toContain("₱500.00");
      expect(text).toContain("Cash");
      expect(text).toContain("₱586.00");
      expect(text).toContain("Cash Received");
      expect(text).toContain("₱1,000.00");
      expect(text).toContain("Change Given");
      expect(text).toContain("₱414.00");
    });

    it("handles non-cash payments without cash received or change rows", () => {
      const cardReceipt: PrintableReceiptData = {
        ...mockSampleReceipt,
        payments: [{ method: "Card", amount: 1086, reference: "AUTH-1234" }],
        totalCashReceived: null,
        changeGiven: null,
      };

      const html = buildThermalReceiptHtml(cardReceipt);
      expect(html).not.toContain("Physical Cash Received");
      expect(html).not.toContain("Change Given");
      expect(html).toContain("Card (AUTH-1234)");
    });
  });

  describe("printThermalReceipt Execution & Isolation", () => {
    it("blocks printing and returns false if transactionId is invalid or sentinel", () => {
      const invalidReceipts = [
        { ...mockSampleReceipt, transactionId: "   " },
        { ...mockSampleReceipt, transactionId: "null" },
        { ...mockSampleReceipt, transactionId: "undefined" },
        { ...mockSampleReceipt, transactionId: "TXN-123456" },
      ];
      for (const rec of invalidReceipts) {
        expect(printThermalReceipt(rec)).toBe(false);
      }
    });

    it("blocks printing if payments array is empty or numbers are invalid", () => {
      expect(printThermalReceipt({ ...mockSampleReceipt, payments: [] })).toBe(false);
      expect(printThermalReceipt({ ...mockSampleReceipt, amountPaid: 0 })).toBe(false);
      expect(printThermalReceipt({ ...mockSampleReceipt, remainingBalance: -50 })).toBe(false);
      expect(printThermalReceipt({ ...mockSampleReceipt, totalPayable: NaN })).toBe(false);
    });

    it("creates isolated iframe with title and aria-hidden attributes", () => {
      const result = printThermalReceipt(mockSampleReceipt);
      expect(result).toBe(true);

      const frame = document.getElementById("__cradle_thermal_receipt_print_frame") as HTMLIFrameElement;
      expect(frame).not.toBeNull();
      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.getAttribute("title")).toBe("Thermal Receipt Printing Frame");
      expect(frame.style.width).toBe("80mm");
    });

    it("never calls host window.print() even if iframe print throws", () => {
      const hostPrintSpy = vi.spyOn(window, "print");
      printThermalReceipt(mockSampleReceipt);
      expect(hostPrintSpy).not.toHaveBeenCalled();
      hostPrintSpy.mockRestore();
    });
  });
});
