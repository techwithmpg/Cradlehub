/**
 * Isolated Browser Verification for 80mm Automatic Thermal Receipt Printing
 * Tests both Standard Chrome and Cashier Kiosk-Printing environments.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  buildThermalReceiptHtml,
  isValidAuthoritativeTransactionId,
  printThermalReceipt,
} from "../src/lib/cash-flow/receipt-printer.ts";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

console.log("==================================================================");
console.log("CRADLEHUB CASH FLOW — 80MM THERMAL RECEIPT HEADLESS BROWSER VERIFICATION");
console.log("DOM Hidden-Frame Isolation & Print Command Dispatch Pipeline");
console.log("------------------------------------------------------------------");
console.log("DISCLAIMER: This script tests DOM hidden-frame isolation, print script");
console.log("execution, and browser command flag parsing in headless Chrome.");
console.log("It does NOT simulate physical printer hardware (paper feed, roll cutter,");
console.log("or spooler hardware), which requires on-device cashier testing.");
console.log("==================================================================");

// 1. Generate HTML harness for browser testing
const harnessHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CradleHub Cash Flow Thermal Printing Verification</title>
</head>
<body>
  <h1>CradleHub CRM Today — Cash Flow Checkout</h1>
  <div id="test-results"></div>

  <script>
    window.__cradle_print_log = [];

    // Attach host print event listeners to detect if host window was printed
    window.addEventListener("beforeprint", function() {
      window.__cradle_print_log.push("HOST_WINDOW_BEFOREPRINT");
    });
    window.addEventListener("afterprint", function() {
      window.__cradle_print_log.push("HOST_WINDOW_AFTERPRINT");
    });

    ${isValidAuthoritativeTransactionId.toString()}
    ${buildThermalReceiptHtml.toString()}
    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function formatReceiptPeso(amount) {
      return "₱" + amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    ${printThermalReceipt.toString()}

    const scenarios = [
      {
        name: "Scenario 1: Cash Payment with Change Calculator",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6801",
          orderNumber: "ORDER-c5cc08fd",
          customerName: "DAWN NAVARRO",
          formattedDateTime: "Oct 30, 2026, 03:00 PM",
          serviceDescription: "Post Natal Massage",
          items: [
            { description: "Post Natal Massage", amount: 800 },
            { description: "Home Service travel", amount: 286 }
          ],
          totalPayable: 1086,
          alreadyPaid: 0,
          amountPaid: 1086,
          remainingBalance: 0,
          payments: [{ method: "Cash", amount: 1086, cashReceived: 1500, change: 414 }],
          totalCashReceived: 1500,
          changeGiven: 414
        }
      },
      {
        name: "Scenario 2: GCash Payment with External Reference",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6802",
          orderNumber: "ORDER-0002",
          customerName: "MARIA CLARA",
          formattedDateTime: "Oct 30, 2026, 03:30 PM",
          serviceDescription: "Swedish Massage",
          items: [{ description: "Swedish Massage", amount: 950 }],
          totalPayable: 950,
          alreadyPaid: 0,
          amountPaid: 950,
          remainingBalance: 0,
          payments: [{ method: "GCash", amount: 950, reference: "GC-20261030-9988" }],
          totalCashReceived: null,
          changeGiven: null
        }
      },
      {
        name: "Scenario 3: Split Tender Payment (Cash + GCash)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6803",
          orderNumber: "ORDER-0003",
          customerName: "ROBERTO CRUZ",
          formattedDateTime: "Oct 30, 2026, 04:00 PM",
          serviceDescription: "Deep Tissue Massage",
          items: [{ description: "Deep Tissue Massage", amount: 1200 }],
          totalPayable: 1200,
          alreadyPaid: 0,
          amountPaid: 1200,
          remainingBalance: 0,
          payments: [
            { method: "Cash", amount: 500, cashReceived: 1000, change: 500 },
            { method: "GCash", amount: 700, reference: "GC-SPLIT-700" }
          ],
          totalCashReceived: 1000,
          changeGiven: 500
        }
      },
      {
        name: "Scenario 4: Partial Payment with Remaining Balance",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6804",
          orderNumber: "ORDER-0004",
          customerName: "ANA SANTOS",
          formattedDateTime: "Oct 30, 2026, 04:30 PM",
          serviceDescription: "Prenatal Massage Package",
          items: [{ description: "Prenatal Massage Package", amount: 2500 }],
          totalPayable: 2500,
          alreadyPaid: 0,
          amountPaid: 1000,
          remainingBalance: 1500,
          payments: [{ method: "Cash", amount: 1000, cashReceived: 1000, change: 0 }],
          totalCashReceived: 1000,
          changeGiven: 0
        }
      },
      {
        name: "Scenario 5: Idempotent Replay Payment Confirmation",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6805",
          orderNumber: "ORDER-0005",
          customerName: "DAWN NAVARRO",
          formattedDateTime: "Oct 30, 2026, 03:00 PM",
          serviceDescription: "Post Natal Massage",
          items: [{ description: "Post Natal Massage", amount: 800 }],
          totalPayable: 800,
          alreadyPaid: 800,
          amountPaid: 800,
          remainingBalance: 0,
          payments: [{ method: "Cash", amount: 800 }],
          isIdempotentReplay: true
        }
      },
      {
        name: "Scenario 6: Stringified Null Rejection (Must Reject)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "null",
          orderNumber: "ORDER-0006",
          customerName: "TEST GUEST",
          formattedDateTime: "Oct 30, 2026, 05:00 PM",
          serviceDescription: "Test Service",
          items: [{ description: "Test Service", amount: 500 }],
          totalPayable: 500,
          alreadyPaid: 0,
          amountPaid: 500,
          remainingBalance: 0,
          payments: [{ method: "Cash", amount: 500 }]
        },
        expectReject: true
      },
      {
        name: "Scenario 7: Fabricated Reference Rejection (Must Reject)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "TXN-c5cc08fd",
          orderNumber: "ORDER-0007",
          customerName: "TEST GUEST",
          formattedDateTime: "Oct 30, 2026, 05:00 PM",
          serviceDescription: "Test Service",
          items: [{ description: "Test Service", amount: 500 }],
          totalPayable: 500,
          alreadyPaid: 0,
          amountPaid: 500,
          remainingBalance: 0,
          payments: [{ method: "Cash", amount: 500 }]
        },
        expectReject: true
      },
      {
        name: "Scenario 8: Non-Finite Total Payable Rejection (Must Reject)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6808",
          orderNumber: "ORDER-0008",
          customerName: "TEST GUEST",
          formattedDateTime: "Oct 30, 2026, 05:00 PM",
          serviceDescription: "Test Service",
          items: [{ description: "Test Service", amount: 500 }],
          totalPayable: NaN,
          alreadyPaid: 0,
          amountPaid: 500,
          remainingBalance: 0,
          payments: [{ method: "Cash", amount: 500 }]
        },
        expectReject: true
      },
      {
        name: "Scenario 9: Empty Tender Payments Rejection (Must Reject)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6809",
          orderNumber: "ORDER-0009",
          customerName: "TEST GUEST",
          formattedDateTime: "Oct 30, 2026, 05:00 PM",
          serviceDescription: "Test Service",
          items: [{ description: "Test Service", amount: 500 }],
          totalPayable: 500,
          alreadyPaid: 0,
          amountPaid: 500,
          remainingBalance: 0,
          payments: []
        },
        expectReject: true
      },
      {
        name: "Scenario 10: Negative Remaining Balance Rejection (Must Reject)",
        data: {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: "Main Spa Branch",
          transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6810",
          orderNumber: "ORDER-0010",
          customerName: "TEST GUEST",
          formattedDateTime: "Oct 30, 2026, 05:00 PM",
          serviceDescription: "Test Service",
          items: [{ description: "Test Service", amount: 500 }],
          totalPayable: 500,
          alreadyPaid: 0,
          amountPaid: 500,
          remainingBalance: -100,
          payments: [{ method: "Cash", amount: 500 }]
        },
        expectReject: true
      }
    ];

    const results = [];
    for (const sc of scenarios) {
      const initiated = printThermalReceipt(sc.data);
      const passed = sc.expectReject ? !initiated : initiated;
      results.push({ name: sc.name, initiated, passed });
    }

    // Check if host window was printed
    const hostWindowPrinted = window.__cradle_print_log.includes("HOST_WINDOW_BEFOREPRINT");
    const iframeCreated = document.getElementById("__cradle_thermal_receipt_print_frame") !== null;

    const summary = {
      results,
      allPassed: results.every(r => r.passed),
      hostWindowPrinted,
      iframeCreated
    };

    document.getElementById("test-results").textContent = JSON.stringify(summary, null, 2);
  </script>
</body>
</html>`;

const tmpDir = path.resolve("./.tmp/browser-test");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const tmpHtmlPath = path.join(tmpDir, "thermal-print-verification.html");
fs.writeFileSync(tmpHtmlPath, harnessHtml, "utf8");
const fileUrl = "file:///" + tmpHtmlPath.replace(/\\/g, "/");

console.log("[1/3] Headless Chrome: Standard Print Command Dispatch Emulation...");
try {
  const stdOutput = execSync(
    `"${chromePath}" --headless=new --disable-gpu --dump-dom "${fileUrl}"`,
    { encoding: "utf8", timeout: 15000 }
  );
  const match = stdOutput.match(/<div id="test-results">([\s\S]*?)<\/div>/);
  if (!match || !match[1] || !match[1].trim()) {
    throw new Error(
      "Standard Chrome headless verification failed: #test-results container not found or empty in DOM dump."
    );
  }
  let data;
  try {
    data = JSON.parse(match[1].trim());
  } catch (parseErr) {
    throw new Error(
      `Standard Chrome headless verification failed: could not parse #test-results JSON: ${parseErr.message}`
    );
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.results)) {
    throw new Error(
      "Standard Chrome headless verification failed: invalid results payload structure."
    );
  }
  console.log("  Standard Chrome Emulation Results:");
  data.results.forEach((r) => {
    console.log(`    ${r.passed ? "✔ PASS" : "✖ FAIL"}: ${r.name} (initiated: ${r.initiated})`);
  });
  console.log(`    ✔ Host Window Protected (no full CRM print): ${!data.hostWindowPrinted}`);
  console.log(`    ✔ Hidden Print Frame Maintained: ${data.iframeCreated}`);
  if (!data.allPassed || data.hostWindowPrinted || !data.iframeCreated) {
    throw new Error("Standard Chrome headless verification scenarios failed!");
  }
} catch (e) {
  console.error("Standard Chrome execution failed:", e.message);
  process.exit(1);
}

console.log("\n[2/3] Headless Chrome: Kiosk Command Flag Emulation (--kiosk --kiosk-printing)...");
try {
  const kioskOutput = execSync(
    `"${chromePath}" --headless=new --disable-gpu --kiosk --kiosk-printing --dump-dom "${fileUrl}"`,
    { encoding: "utf8", timeout: 15000 }
  );
  const match = kioskOutput.match(/<div id="test-results">([\s\S]*?)<\/div>/);
  if (!match || !match[1] || !match[1].trim()) {
    throw new Error(
      "Headless Chrome kiosk flag verification failed: #test-results container not found or empty in DOM dump."
    );
  }
  let data;
  try {
    data = JSON.parse(match[1].trim());
  } catch (parseErr) {
    throw new Error(
      `Headless Chrome kiosk flag verification failed: could not parse #test-results JSON: ${parseErr.message}`
    );
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.results)) {
    throw new Error(
      "Headless Chrome kiosk flag verification failed: invalid results payload structure."
    );
  }
  console.log("  Headless Chrome Kiosk Flag Emulation Results:");
  data.results.forEach((r) => {
    console.log(`    ${r.passed ? "✔ PASS" : "✖ FAIL"}: ${r.name} (initiated: ${r.initiated})`);
  });
  console.log(`    ✔ Host Window Protected (no full CRM print): ${!data.hostWindowPrinted}`);
  console.log(`    ✔ Hidden Print Frame Maintained: ${data.iframeCreated}`);
  if (!data.allPassed || data.hostWindowPrinted || !data.iframeCreated) {
    throw new Error("Headless Chrome kiosk flag verification scenarios failed!");
  }
} catch (e) {
  console.error("Headless Chrome kiosk flag execution failed:", e.message);
  process.exit(1);
}

console.log("\n[3/3] Verification Complete: All Browser Printing Emulation Tests PASSED Cleanly!");
console.log("==================================================================");
