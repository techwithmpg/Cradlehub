/**
 * Pure 80mm thermal receipt layout and printing integration.
 * Complies with Section 6 & 7 of Cash Flow Payment Receipt Specifications.
 * Purely client-safe with no DB mutations or side-effects on financial posting.
 */

export interface PrintableReceiptItem {
  description: string;
  amount: number;
}

export interface PrintableReceiptTender {
  method: string;
  amount: number;
  reference?: string | null;
  cashReceived?: number | null;
  change?: number | null;
}

export interface PrintableReceiptData {
  companyName?: string;
  branchName: string;
  transactionId: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  formattedDateTime: string;
  serviceDescription: string;
  visitType?: "in_spa" | "home_service";
  items: PrintableReceiptItem[];
  totalPayable: number;
  alreadyPaid: number;
  amountPaid: number;
  remainingBalance: number;
  payments: PrintableReceiptTender[];
  totalCashReceived?: number | null;
  changeGiven?: number | null;
  cashierName?: string | null;
  isReprint?: boolean;
  isIdempotentReplay?: boolean;
  receiptLabel?: string;
}

export function formatReceiptPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Builds HTML document formatted for 80mm roll thermal printing.
 */
export function buildThermalReceiptHtml(data: PrintableReceiptData): string {
  const company = data.companyName || "CRADLE WELLNESS LIVING INC.";
  const branch = data.branchName || "Main Spa";
  const reprintBanner = data.isReprint
    ? `<div style="text-align:center; font-weight:bold; border:1px solid #000; padding:2px 0; margin-bottom:6px;">*** DUPLICATE / REPRINT ***</div>`
    : data.isIdempotentReplay
      ? `<div style="text-align:center; font-weight:bold; border:1px solid #000; padding:2px 0; margin-bottom:6px;">*** PREVIOUSLY RECORDED PAYMENT ***<br><span style="font-size:9px; font-weight:normal;">Idempotent Replay Confirmation</span></div>`
      : "";

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 2px 0; vertical-align: top;">${escapeHtml(item.description)}</td>
        <td style="padding: 2px 0; text-align: right; white-space: nowrap; vertical-align: top;">
          ${formatReceiptPeso(item.amount)}
        </td>
      </tr>`
    )
    .join("");

  const tendersHtml = data.payments
    .map(
      (p) => `
      <tr>
        <td style="padding: 1px 0;">${escapeHtml(p.method)}${p.reference ? ` (${escapeHtml(p.reference)})` : ""}</td>
        <td style="padding: 1px 0; text-align: right; white-space: nowrap;">${formatReceiptPeso(p.amount)}</td>
      </tr>`
    )
    .join("");

  const cashRows =
    data.totalCashReceived !== undefined &&
    data.totalCashReceived !== null &&
    data.changeGiven !== undefined &&
    data.changeGiven !== null
      ? `
      <tr>
        <td style="padding: 1px 0; padding-left: 8px; color: #222;">Physical Cash Received</td>
        <td style="padding: 1px 0; text-align: right;">${formatReceiptPeso(data.totalCashReceived)}</td>
      </tr>
      <tr>
        <td style="padding: 1px 0; padding-left: 8px; font-weight: bold;">Change Given</td>
        <td style="padding: 1px 0; text-align: right; font-weight: bold;">${formatReceiptPeso(data.changeGiven)}</td>
      </tr>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Acknowledgment - ${escapeHtml(data.orderNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 72mm;
      margin: 4mm auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .company {
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .branch {
      font-size: 11px;
      margin-top: 2px;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .meta-table, .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .meta-table td {
      padding: 1px 0;
    }
    .meta-label {
      color: #333;
      width: 40%;
    }
    .total-row {
      font-size: 12px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 10px;
      font-size: 10px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  ${reprintBanner}
  <div class="header">
    <div class="company">${escapeHtml(company)}</div>
    <div class="branch">${escapeHtml(branch)}</div>
  </div>

  <div class="divider"></div>

  <table class="meta-table">
    <tr><td class="meta-label">Date/Time:</td><td>${escapeHtml(data.formattedDateTime)}</td></tr>
    <tr><td class="meta-label">Order Ref:</td><td><strong>${escapeHtml(data.orderNumber)}</strong></td></tr>
    <tr><td class="meta-label">Txn Ref:</td><td>${escapeHtml(data.transactionId)}</td></tr>
    <tr><td class="meta-label">Customer:</td><td><strong>${escapeHtml(data.customerName)}</strong></td></tr>
    ${data.customerPhone ? `<tr><td class="meta-label">Phone:</td><td>${escapeHtml(data.customerPhone)}</td></tr>` : ""}
    ${data.visitType ? `<tr><td class="meta-label">Type:</td><td>${data.visitType === "home_service" ? "Home Service" : "In-Spa"}</td></tr>` : ""}
    ${data.cashierName ? `<tr><td class="meta-label">Cashier:</td><td>${escapeHtml(data.cashierName)}</td></tr>` : ""}
  </table>

  <div class="divider"></div>

  <table class="data-table">
    <thead>
      <tr style="text-align: left; border-bottom: 1px dashed #000;">
        <th style="padding-bottom: 3px;">Service / Item</th>
        <th style="padding-bottom: 3px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="divider"></div>

  <table class="data-table">
    <tr>
      <td>Total Payable</td>
      <td style="text-align: right;">${formatReceiptPeso(data.totalPayable)}</td>
    </tr>
    ${
      data.alreadyPaid > 0
        ? `<tr>
        <td>Previously Paid</td>
        <td style="text-align: right;">${formatReceiptPeso(data.alreadyPaid)}</td>
      </tr>`
        : ""
    }
    <tr class="total-row" style="border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
      <td style="padding: 4px 0;">Amount Paid Now</td>
      <td style="padding: 4px 0; text-align: right;">${formatReceiptPeso(data.amountPaid)}</td>
    </tr>
  </table>

  <div style="margin-top: 4px;">
    <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">PAYMENT BREAKDOWN:</div>
    <table class="data-table">
      ${tendersHtml}
      ${cashRows}
    </table>
  </div>

  <div class="divider"></div>

  <table class="data-table">
    <tr style="font-weight: bold;">
      <td>Remaining Balance</td>
      <td style="text-align: right;">${formatReceiptPeso(data.remainingBalance)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="footer">
    <div>*** ${escapeHtml(data.receiptLabel || "PAYMENT ACKNOWLEDGMENT")} ***</div>
    <div>Supplementary payment record only.</div>
    <div>Not a BIR-registered invoice.</div>
    <div style="margin-top: 4px;">Thank you for choosing Cradle Wellness Living!</div>
  </div>
</body>
</html>`;
}

/**
 * Builds text-formatted receipt for text logging or monospace previews.
 */
export function buildThermalReceiptText(data: PrintableReceiptData): string {
  const W = 32;
  const pad = (left: string, right: string) => {
    const space = Math.max(1, W - left.length - right.length);
    return left + " ".repeat(space) + right;
  };
  const center = (text: string) => {
    const l = Math.max(0, Math.floor((W - text.length) / 2));
    return " ".repeat(l) + text;
  };

  const lines: string[] = [];
  lines.push("=".repeat(W));
  lines.push(center(data.companyName || "CRADLE WELLNESS LIVING INC."));
  lines.push(center(data.branchName || "Main Spa"));
  if (data.isReprint) {
    lines.push(center("*** REPRINT ***"));
  } else if (data.isIdempotentReplay) {
    lines.push(center("*** PREVIOUSLY RECORDED PAYMENT ***"));
    lines.push(center("(Idempotent Replay Confirmation)"));
  }
  lines.push("=".repeat(W));
  lines.push(`Date: ${data.formattedDateTime}`);
  lines.push(`Order: ${data.orderNumber}`);
  lines.push(`Txn: ${data.transactionId}`);
  lines.push(`Guest: ${data.customerName}`);
  if (data.customerPhone) lines.push(`Phone: ${data.customerPhone}`);
  lines.push("-".repeat(W));
  for (const item of data.items) {
    lines.push(pad(item.description.slice(0, 20), formatReceiptPeso(item.amount)));
  }
  lines.push("-".repeat(W));
  lines.push(pad("Total Payable", formatReceiptPeso(data.totalPayable)));
  if (data.alreadyPaid > 0) {
    lines.push(pad("Previously Paid", formatReceiptPeso(data.alreadyPaid)));
  }
  lines.push(pad("Amount Paid Now", formatReceiptPeso(data.amountPaid)));
  lines.push("-".repeat(W));
  lines.push("Tender Breakdown:");
  for (const p of data.payments) {
    lines.push(pad(`  ${p.method}`, formatReceiptPeso(p.amount)));
  }
  if (data.totalCashReceived !== undefined && data.totalCashReceived !== null) {
    lines.push(pad("  Cash Received", formatReceiptPeso(data.totalCashReceived)));
    lines.push(pad("  Change Given", formatReceiptPeso(data.changeGiven ?? 0)));
  }
  lines.push("-".repeat(W));
  lines.push(pad("Remaining Balance", formatReceiptPeso(data.remainingBalance)));
  lines.push("=".repeat(W));
  lines.push(center(data.receiptLabel || "PAYMENT ACKNOWLEDGMENT"));
  lines.push(center("Supplementary payment record only."));
  lines.push(center("Not a BIR-registered invoice."));
  lines.push(center("Thank you!"));
  lines.push("=".repeat(W));

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Initiates automatic browser printing using a detached hidden iframe.
 * Avoids popup blockers and isolates 80mm thermal receipt CSS styles.
 */
export function printThermalReceipt(data: PrintableReceiptData): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Require a genuine non-empty confirmed transaction ID before printing
  if (!data.transactionId || typeof data.transactionId !== "string" || data.transactionId.trim() === "") {
    console.error("Thermal receipt print rejected: Authoritative transactionId is required.");
    return false;
  }

  try {
    const iframeId = "__cradle_thermal_receipt_print_frame";
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "80mm";
    iframe.style.height = "100px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return false;
    }

    doc.open();
    doc.write(buildThermalReceiptHtml(data));
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return false;
    }

    // Give DOM a frame to layout before print dialog
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.warn("Iframe print invocation failed, falling back to window.print", err);
        try {
          window.print();
        } catch {
          // Ignore
        }
      }
    }, 150);

    return true;
  } catch (error) {
    console.error("Thermal receipt print error:", error);
    return false;
  }
}
