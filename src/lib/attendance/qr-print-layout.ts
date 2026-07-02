import type { QrPointType } from "@/lib/attendance/types";

export type QrPrintFormat = "a4" | "a5" | "door" | "sticker" | "sheet";

export type QrPrintPoint = {
  label: string;
  pointType: QrPointType;
  qrSvg: string | null;
  branchName: string;
};

export type QrPrintLayout = {
  key: QrPrintFormat;
  label: string;
  width: number;
  height: number;
  qrSize: number;
  footerHeight: number;
};

export const QR_PRINT_LAYOUTS: Record<QrPrintFormat, QrPrintLayout> = {
  a4: { key: "a4", label: "A4 Poster", width: 794, height: 1123, qrSize: 260, footerHeight: 88 },
  a5: { key: "a5", label: "A5 Sign", width: 559, height: 794, qrSize: 210, footerHeight: 70 },
  door: { key: "door", label: "Door Label", width: 420, height: 594, qrSize: 172, footerHeight: 56 },
  sticker: { key: "sticker", label: "Small Sticker", width: 320, height: 320, qrSize: 128, footerHeight: 42 },
  sheet: { key: "sheet", label: "Label Sheet", width: 816, height: 1056, qrSize: 190, footerHeight: 76 },
};

export function getQrPrintLayout(format: QrPrintFormat): QrPrintLayout {
  return QR_PRINT_LAYOUTS[format];
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function qrDataUri(qrSvg: string | null): string {
  const fallback =
    '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280"><rect width="280" height="280" fill="white"/><text x="140" y="145" text-anchor="middle" font-size="18" fill="#111827">QR unavailable</text></svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg ?? fallback)}`;
}

export function buildQrPrintSvg(point: QrPrintPoint, format: QrPrintFormat): string {
  const layout = getQrPrintLayout(format);
  const title = point.pointType === "attendance" ? "STAFF ATTENDANCE" : point.label.toUpperCase();
  const instruction = point.pointType === "attendance" ? "Scan when arriving" : "Scan to start service";
  const instructionTwo = point.pointType === "attendance" ? "Scan again when leaving" : "";
  const qrX = (layout.width - layout.qrSize) / 2;
  const qrY = layout.height * (format === "sticker" ? 0.35 : 0.44) - layout.qrSize / 2;
  const footerY = layout.height - layout.footerHeight;
  const logoY = format === "sticker" ? 44 : Math.max(58, layout.height * 0.11);
  const titleY = format === "sticker" ? 92 : logoY + 76;
  const scanY = qrY + layout.qrSize + (format === "sticker" ? 34 : 54);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeSvgText(title)} QR sign">
  <rect width="100%" height="100%" rx="8" fill="#FCF7EC"/>
  <rect x="18" y="18" width="${layout.width - 36}" height="${layout.height - 36}" rx="8" fill="none" stroke="#D8B866" stroke-opacity="0.32"/>
  <text x="${layout.width / 2}" y="${logoY}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 15 : 27}" letter-spacing="5" fill="#B4822C">CRADLE</text>
  <text x="${layout.width / 2}" y="${logoY + (format === "sticker" ? 17 : 25)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${format === "sticker" ? 6 : 10}" letter-spacing="4" fill="#C79A3F">WELLNESS LIVING</text>
  <line x1="${layout.width * 0.18}" y1="${titleY + 34}" x2="${layout.width * 0.39}" y2="${titleY + 34}" stroke="#C79A3F" stroke-width="2"/>
  <line x1="${layout.width * 0.61}" y1="${titleY + 34}" x2="${layout.width * 0.82}" y2="${titleY + 34}" stroke="#C79A3F" stroke-width="2"/>
  <text x="${layout.width / 2}" y="${titleY}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 22 : 39}" font-weight="700" letter-spacing="1.5" fill="#0F4D2F">${escapeSvgText(title)}</text>
  <path d="M ${layout.width / 2} ${titleY + 28} C ${layout.width / 2 - 10} ${titleY + 44}, ${layout.width / 2 - 24} ${titleY + 51}, ${layout.width / 2 - 38} ${titleY + 53} C ${layout.width / 2 - 24} ${titleY + 57}, ${layout.width / 2 - 9} ${titleY + 52}, ${layout.width / 2} ${titleY + 35} Z" fill="#C79A3F" opacity="0.82"/>
  <path d="M ${layout.width / 2} ${titleY + 28} C ${layout.width / 2 + 10} ${titleY + 44}, ${layout.width / 2 + 24} ${titleY + 51}, ${layout.width / 2 + 38} ${titleY + 53} C ${layout.width / 2 + 24} ${titleY + 57}, ${layout.width / 2 + 9} ${titleY + 52}, ${layout.width / 2} ${titleY + 35} Z" fill="#C79A3F" opacity="0.82"/>
  <path d="M ${layout.width / 2} ${titleY + 24} C ${layout.width / 2 - 6} ${titleY + 42}, ${layout.width / 2 - 4} ${titleY + 55}, ${layout.width / 2} ${titleY + 64} C ${layout.width / 2 + 4} ${titleY + 55}, ${layout.width / 2 + 6} ${titleY + 42}, ${layout.width / 2} ${titleY + 24} Z" fill="#C79A3F"/>
  <rect x="${qrX - 14}" y="${qrY - 14}" width="${layout.qrSize + 28}" height="${layout.qrSize + 28}" rx="10" fill="#FFFFFF" stroke="#C79A3F" stroke-width="2"/>
  <image href="${qrDataUri(point.qrSvg)}" x="${qrX}" y="${qrY}" width="${layout.qrSize}" height="${layout.qrSize}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${layout.width / 2}" y="${scanY}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 17 : 29}" font-weight="700" fill="#0F4D2F">${escapeSvgText(instruction)}</text>
  ${instructionTwo ? `<text x="${layout.width / 2}" y="${scanY + 32}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 17 : 29}" font-weight="700" fill="#0F4D2F">${escapeSvgText(instructionTwo)}</text>` : ""}
  <rect x="0" y="${footerY}" width="${layout.width}" height="${layout.footerHeight}" rx="0" fill="#0B5634"/>
  <text x="${layout.width / 2}" y="${footerY + layout.footerHeight / 2 + 10}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 17 : 29}" font-weight="700" letter-spacing="4" fill="#E6BE60">${escapeSvgText(point.branchName.toUpperCase())}</text>
  <path d="M ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 1} C ${layout.width - 73} ${footerY + layout.footerHeight / 2 - 15}, ${layout.width - 82} ${footerY + layout.footerHeight / 2 - 18}, ${layout.width - 91} ${footerY + layout.footerHeight / 2 - 12} C ${layout.width - 81} ${footerY + layout.footerHeight / 2 - 6}, ${layout.width - 72} ${footerY + layout.footerHeight / 2 - 5}, ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 1} Z" fill="#E6BE60" opacity="0.9"/>
  <path d="M ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 1} C ${layout.width - 55} ${footerY + layout.footerHeight / 2 - 15}, ${layout.width - 46} ${footerY + layout.footerHeight / 2 - 18}, ${layout.width - 37} ${footerY + layout.footerHeight / 2 - 12} C ${layout.width - 47} ${footerY + layout.footerHeight / 2 - 6}, ${layout.width - 56} ${footerY + layout.footerHeight / 2 - 5}, ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 1} Z" fill="#E6BE60" opacity="0.9"/>
  <path d="M ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 7} C ${layout.width - 68} ${footerY + layout.footerHeight / 2 + 8}, ${layout.width - 67} ${footerY + layout.footerHeight / 2 + 18}, ${layout.width - 64} ${footerY + layout.footerHeight / 2 + 25} C ${layout.width - 61} ${footerY + layout.footerHeight / 2 + 18}, ${layout.width - 60} ${footerY + layout.footerHeight / 2 + 8}, ${layout.width - 64} ${footerY + layout.footerHeight / 2 - 7} Z" fill="#E6BE60"/>
</svg>`;
}
