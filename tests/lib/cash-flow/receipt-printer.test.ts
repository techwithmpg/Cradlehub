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
  describe("Authoritative Transaction Reference Validator (isValidAuthoritativeTransactionId)", () => {
    it("accepts valid RFC 4122 and standard hexadecimal UUIDs", () => {
      expect(isValidAuthoritativeTransactionId("c5cc08fd-9912-4f32-8ea3-289b41dc6801")).toBe(true);
      expect(isValidAuthoritativeTransactionId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
      expect(isValidAuthoritativeTransactionId("A5CC08FD-9912-4F32-8EA3-289B41DC6801")).toBe(true);
    });

    it("strictly rejects stringified null, undefined, and sentinel values", () => {
      expect(isValidAuthoritativeTransactionId("null")).toBe(false);
      expect(isValidAuthoritativeTransactionId("NULL")).toBe(false);
      expect(isValidAuthoritativeTransactionId("undefined")).toBe(false);
      expect(isValidAuthoritativeTransactionId("UNDEFINED")).toBe(false);
      expect(isValidAuthoritativeTransactionId("none")).toBe(false);
      expect(isValidAuthoritativeTransactionId("n/a")).toBe(false);
      expect(isValidAuthoritativeTransactionId("N/A")).toBe(false);
      expect(isValidAuthoritativeTransactionId("[object Object]")).toBe(false);
      expect(isValidAuthoritativeTransactionId("nan")).toBe(false);
      expect(isValidAuthoritativeTransactionId("unknown")).toBe(false);
      expect(isValidAuthoritativeTransactionId("false")).toBe(false);
    });

    it("strictly rejects fabricated and placeholder prefixes", () => {
      expect(isValidAuthoritativeTransactionId("TXN-c5cc08fd-9912")).toBe(false);
      expect(isValidAuthoritativeTransactionId("txn-12345")).toBe(false);
      expect(isValidAuthoritativeTransactionId("MOCK-c5cc08fd")).toBe(false);
      expect(isValidAuthoritativeTransactionId("TEMP-9912")).toBe(false);
      expect(isValidAuthoritativeTransactionId("FAKE-tx-001")).toBe(false);
      expect(isValidAuthoritativeTransactionId("TEST-transaction")).toBe(false);
      expect(isValidAuthoritativeTransactionId("DUMMY-id")).toBe(false);
    });

    it("rejects nil UUID, empty strings, whitespace, and non-string inputs", () => {
      expect(isValidAuthoritativeTransactionId("00000000-0000-0000-0000-000000000000")).toBe(false);
      expect(isValidAuthoritativeTransactionId("")).toBe(false);
      expect(isValidAuthoritativeTransactionId("    ")).toBe(false);
      expect(isValidAuthoritativeTransactionId(null)).toBe(false);
      expect(isValidAuthoritativeTransactionId(undefined)).toBe(false);
      expect(isValidAuthoritativeTransactionId(123456)).toBe(false);
      expect(isValidAuthoritativeTransactionId({})).toBe(false);
    });
  });

  describe("Formatting and Content Construction", () => {
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

    it("renders duplicate reprint banner when isReprint is true", () => {
      const reprintReceipt: PrintableReceiptData = {
        ...mockSampleReceipt,
        isReprint: true,
      };
      const html = buildThermalReceiptHtml(reprintReceipt);
      expect(html).toContain("*** DUPLICATE / REPRINT ***");

      const text = buildThermalReceiptText(reprintReceipt);
      expect(text).toContain("*** REPRINT ***");
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

  describe("Automatic Background Print Initiation (printThermalReceipt)", () => {
    it("rejects stringified null or undefined transaction IDs without printing", () => {
      const hostPrintSpy = vi.spyOn(window, "print");
      const nullReceipt = { ...mockSampleReceipt, transactionId: "null" };
      const undefinedReceipt = { ...mockSampleReceipt, transactionId: "undefined" };

      expect(printThermalReceipt(nullReceipt)).toBe(false);
      expect(printThermalReceipt(undefinedReceipt)).toBe(false);
      expect(hostPrintSpy).not.toHaveBeenCalled();
      hostPrintSpy.mockRestore();
    });

    it("rejects fabricated transaction references (TXN-*) without printing", () => {
      const hostPrintSpy = vi.spyOn(window, "print");
      const fabricatedReceipt = { ...mockSampleReceipt, transactionId: "TXN-c5cc08fd-9912" };

      expect(printThermalReceipt(fabricatedReceipt)).toBe(false);
      expect(hostPrintSpy).not.toHaveBeenCalled();
      hostPrintSpy.mockRestore();
    });

    it("rejects missing, empty, or non-positive payment movements", () => {
      const hostPrintSpy = vi.spyOn(window, "print");
      const emptyPaymentsReceipt = { ...mockSampleReceipt, payments: [] };
      const zeroAmountReceipt = { ...mockSampleReceipt, amountPaid: 0 };

      expect(printThermalReceipt(emptyPaymentsReceipt)).toBe(false);
      expect(printThermalReceipt(zeroAmountReceipt)).toBe(false);
      expect(hostPrintSpy).not.toHaveBeenCalled();
      hostPrintSpy.mockRestore();
    });

    it("rejects non-finite or negative totalPayable, remainingBalance, or alreadyPaid", () => {
      const hostPrintSpy = vi.spyOn(window, "print");
      const nanTotalReceipt = { ...mockSampleReceipt, totalPayable: NaN };
      const negativeBalanceReceipt = { ...mockSampleReceipt, remainingBalance: -10 };
      const negativePaidReceipt = { ...mockSampleReceipt, alreadyPaid: -50 };

      expect(printThermalReceipt(nanTotalReceipt)).toBe(false);
      expect(printThermalReceipt(negativeBalanceReceipt)).toBe(false);
      expect(printThermalReceipt(negativePaidReceipt)).toBe(false);
      expect(hostPrintSpy).not.toHaveBeenCalled();
      hostPrintSpy.mockRestore();
    });

    it("creates an isolated hidden print iframe and dispatches print to it", () => {
      const result = printThermalReceipt(mockSampleReceipt);
      expect(result).toBe(true);

      const frame = document.getElementById("__cradle_thermal_receipt_print_frame") as HTMLIFrameElement;
      expect(frame).toBeTruthy();
      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.style.position).toBe("fixed");
      expect(frame.style.top).toBe("-9999px");
      expect(frame.style.left).toBe("-9999px");
      expect(frame.style.opacity).toBe("0");
    });

    it("never calls host window.print() even if iframe print throws an error (prevents full CRM page print)", () => {
      const hostPrintSpy = vi.spyOn(window, "print");

      // Spy on appendChild to inject a throwing contentWindow.print
      const originalAppendChild = document.body.appendChild.bind(document.body);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
        const appended = originalAppendChild(node);
        if (node instanceof HTMLIFrameElement && node.id === "__cradle_thermal_receipt_print_frame") {
          if (node.contentWindow) {
            node.contentWindow.print = vi.fn().mockImplementation(() => {
              throw new Error("Printer driver blocked");
            });
          }
        }
        return appended;
      });

      const result = printThermalReceipt(mockSampleReceipt);
      expect(result).toBe(false);
      // Unsafe fallback must NEVER be triggered
      expect(hostPrintSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
