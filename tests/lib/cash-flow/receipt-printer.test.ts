/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  buildThermalReceiptHtml,
  buildThermalReceiptText,
  formatReceiptPeso,
  printThermalReceipt,
  type PrintableReceiptData,
} from "../../../src/lib/cash-flow/receipt-printer";

const mockSampleReceipt: PrintableReceiptData = {
  companyName: "CRADLE WELLNESS LIVING INC.",
  branchName: "Main Spa Branch",
  transactionId: "TXN-c5cc08fd-9912",
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
    expect(html).toContain("TXN-c5cc08fd-9912");
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

  it("blocks printing and returns false if transactionId is empty or whitespace", () => {
    const invalidReceipt = {
      ...mockSampleReceipt,
      transactionId: "   ",
    };
    const printSpy = vi.spyOn(window, "print");
    const result = printThermalReceipt(invalidReceipt);
    expect(result).toBe(false);
    expect(printSpy).not.toHaveBeenCalled();
    printSpy.mockRestore();
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

  it("safely attempts printing in browser / dom environments", () => {
    const originalPrint = window.print;
    window.print = vi.fn();

    const result = printThermalReceipt(mockSampleReceipt);
    expect(typeof result).toBe("boolean");

    window.print = originalPrint;
  });
});
