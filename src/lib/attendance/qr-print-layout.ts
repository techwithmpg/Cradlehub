import type { AttendanceQrPoint, QrPointType } from "@/lib/attendance/types";

export type QrPrintFormat = "a4" | "a5" | "door" | "sticker" | "sheet";

export type QrPrintPoint = {
  label: string;
  pointType: QrPointType;
  qrSvg: string | null;
  branchName: string;
  resourceName?: string | null;
  resourceCapacity?: number | null;
  isActive?: boolean;
};

export type QrPrintLayout = {
  key: QrPrintFormat;
  label: string;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
  qrSize: number;
  footerHeight: number;
};

export type QrPosterContent = {
  kind: "attendance" | "room";
  title: string;
  subtitle: string | null;
  branchName: string;
  qrSvg: string | null;
  capacityLabel: string | null;
  statusLabel: "ACTIVE" | "INACTIVE" | null;
  primaryInstructions: readonly string[];
  guidance: readonly string[];
  distinction: string;
};

export const QR_PRINT_LAYOUTS: Record<QrPrintFormat, QrPrintLayout> = {
  a4: {
    key: "a4",
    label: "A4 Poster",
    width: 794,
    height: 1123,
    widthMm: 210,
    heightMm: 297,
    qrSize: 260,
    footerHeight: 88,
  },
  a5: {
    key: "a5",
    label: "A5 Sign",
    width: 559,
    height: 794,
    widthMm: 148,
    heightMm: 210,
    qrSize: 210,
    footerHeight: 70,
  },
  door: {
    key: "door",
    label: "Door Label",
    width: 420,
    height: 594,
    widthMm: 111,
    heightMm: 157,
    qrSize: 172,
    footerHeight: 56,
  },
  sticker: {
    key: "sticker",
    label: "Small Sticker",
    width: 320,
    height: 320,
    widthMm: 85,
    heightMm: 85,
    qrSize: 128,
    footerHeight: 42,
  },
  sheet: {
    key: "sheet",
    label: "Label Sheet",
    width: 816,
    height: 1056,
    widthMm: 216,
    heightMm: 279,
    qrSize: 190,
    footerHeight: 76,
  },
};

const ATTENDANCE_GUIDANCE = [
  "Use your registered staff phone.",
  "Keep the scan page open until the final result appears.",
  "This QR records clock-in and clock-out only.",
  "This QR does not start a room or service session.",
] as const;

const ROOM_GUIDANCE = [
  "Clock in using the Attendance QR first.",
  "Confirm the correct customer and service.",
  "Confirm the correct room.",
  "Scan this Room QR when the service is ready to begin.",
  "Keep the page open until the service countdown appears.",
  "Do not move this sign to another room.",
  "Contact CRM or Front Desk if the room or booking shown is incorrect.",
] as const;

export function getQrPrintLayout(format: QrPrintFormat): QrPrintLayout {
  return QR_PRINT_LAYOUTS[format];
}

export function toQrPrintPoint(point: AttendanceQrPoint, branchName: string): QrPrintPoint {
  return {
    label: point.label,
    pointType: point.point_type,
    qrSvg: point.svg,
    branchName,
    resourceName: point.resource_name,
    resourceCapacity: point.resource_capacity,
    isActive: point.is_active && point.resource_is_active !== false,
  };
}

export function createQrPosterContent(point: QrPrintPoint): QrPosterContent {
  const branchName = point.branchName.trim() || "Cradle Wellness Living";

  if (point.pointType === "attendance") {
    return {
      kind: "attendance",
      title: "STAFF ATTENDANCE",
      subtitle: null,
      branchName,
      qrSvg: point.qrSvg,
      capacityLabel: null,
      statusLabel: null,
      primaryInstructions: ["Scan when arriving", "Scan again when leaving"],
      guidance: ATTENDANCE_GUIDANCE,
      distinction: "Attendance QR · Clock-in and clock-out only",
    };
  }

  const resourceName = (point.resourceName ?? point.label).trim() || "ROOM";
  const capacity = point.resourceCapacity;

  return {
    kind: "room",
    title: resourceName.toUpperCase(),
    subtitle: "SERVICE SESSION",
    branchName,
    qrSvg: point.qrSvg,
    capacityLabel: typeof capacity === "number" && capacity > 0 ? `Capacity ${capacity}` : null,
    statusLabel: point.isActive === false ? "INACTIVE" : "ACTIVE",
    primaryInstructions: ["Scan when the service is ready to begin"],
    guidance: ROOM_GUIDANCE,
    distinction: "This QR does not clock staff in or out.",
  };
}

export function qrSvgDataUri(qrSvg: string | null): string {
  const fallback =
    '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280"><rect width="280" height="280" fill="#FFFFFF"/><text x="140" y="145" text-anchor="middle" font-size="18" fill="#000000">QR unavailable</text></svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg ?? fallback)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function guidanceSvg(content: QrPosterContent, startY: number, fontSize: number): string {
  if (content.kind === "attendance") {
    return content.guidance
      .map(
        (line, index) =>
          `<text x="397" y="${startY + index * 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#42624F">${escapeSvgText(line)}</text>`
      )
      .join("");
  }

  return content.guidance
    .map(
      (line, index) =>
        `<text x="170" y="${startY + index * 19}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#264D39"><tspan font-weight="700">${index + 1}.</tspan><tspan dx="8">${escapeSvgText(line)}</tspan></text>`
    )
    .join("");
}

export function buildQrPrintSvg(point: QrPrintPoint, format: QrPrintFormat): string {
  const layout = getQrPrintLayout(format);
  const content = createQrPosterContent(point);
  const isCompact = format !== "a4";
  const titleSize = format === "sticker" ? 20 : content.title.length > 22 ? 30 : 38;
  const logoY = format === "sticker" ? 38 : Math.max(58, layout.height * 0.092);
  const titleY = format === "sticker" ? 84 : logoY + 88;
  const qrSize = layout.qrSize;
  const qrX = (layout.width - qrSize) / 2;
  const qrY =
    content.kind === "room" && format === "a4"
      ? 292
      : layout.height * (format === "sticker" ? 0.51 : 0.43) - qrSize / 2;
  const scanY = qrY + qrSize + (format === "sticker" ? 25 : 43);
  const footerY = layout.height - layout.footerHeight;
  const meta = [content.capacityLabel, content.statusLabel].filter(Boolean).join(" · ");
  const guidance = isCompact
    ? ""
    : guidanceSvg(
        content,
        content.kind === "room" ? scanY + 70 : scanY + 78,
        content.kind === "room" ? 13 : 12
      );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeSvgText(content.title)} QR sign">
  <rect width="100%" height="100%" fill="#FCF7EC"/>
  <rect x="18" y="18" width="${layout.width - 36}" height="${layout.height - 36}" rx="8" fill="none" stroke="#D8B866" stroke-opacity="0.48"/>
  <text x="${layout.width / 2}" y="${logoY}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 15 : 27}" letter-spacing="5" fill="#B4822C">CRADLE</text>
  <text x="${layout.width / 2}" y="${logoY + (format === "sticker" ? 17 : 24)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${format === "sticker" ? 6 : 9}" letter-spacing="4" fill="#C79A3F">WELLNESS LIVING</text>
  <text x="${layout.width / 2}" y="${titleY}" text-anchor="middle" font-family="Georgia, serif" font-size="${titleSize}" font-weight="700" letter-spacing="1.2" fill="#0F4D2F">${escapeSvgText(content.title)}</text>
  ${content.subtitle ? `<text x="${layout.width / 2}" y="${titleY + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="4" fill="#0F4D2F">${escapeSvgText(content.subtitle)}</text>` : ""}
  ${meta ? `<text x="${layout.width / 2}" y="${titleY + 51}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1.2" fill="#9A6A1D">${escapeSvgText(meta)}</text>` : ""}
  <line x1="${layout.width * 0.18}" y1="${titleY + 58}" x2="${layout.width * 0.39}" y2="${titleY + 58}" stroke="#C79A3F" stroke-width="2"/>
  <line x1="${layout.width * 0.61}" y1="${titleY + 58}" x2="${layout.width * 0.82}" y2="${titleY + 58}" stroke="#C79A3F" stroke-width="2"/>
  <path d="M ${layout.width / 2} ${titleY + 46} C ${layout.width / 2 - 12} ${titleY + 65}, ${layout.width / 2 - 27} ${titleY + 67}, ${layout.width / 2 - 40} ${titleY + 68} C ${layout.width / 2 - 24} ${titleY + 76}, ${layout.width / 2 - 9} ${titleY + 68}, ${layout.width / 2} ${titleY + 52} C ${layout.width / 2 + 9} ${titleY + 68}, ${layout.width / 2 + 24} ${titleY + 76}, ${layout.width / 2 + 40} ${titleY + 68} C ${layout.width / 2 + 27} ${titleY + 67}, ${layout.width / 2 + 12} ${titleY + 65}, ${layout.width / 2} ${titleY + 46} Z" fill="#C79A3F"/>
  <rect x="${qrX - 14}" y="${qrY - 14}" width="${qrSize + 28}" height="${qrSize + 28}" rx="10" fill="#FFFFFF" stroke="#C79A3F" stroke-width="2"/>
  <image href="${qrSvgDataUri(content.qrSvg)}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet"/>
  ${content.primaryInstructions.map((line, index) => `<text x="${layout.width / 2}" y="${scanY + index * 30}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 14 : content.kind === "room" ? 22 : 27}" font-weight="700" fill="#0F4D2F">${escapeSvgText(line)}</text>`).join("")}
  ${guidance}
  ${!isCompact ? `<text x="${layout.width / 2}" y="${footerY - 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0F4D2F">${escapeSvgText(content.distinction)}</text>` : ""}
  <rect x="0" y="${footerY}" width="${layout.width}" height="${layout.footerHeight}" fill="#0B5634"/>
  <text x="${layout.width / 2}" y="${footerY + layout.footerHeight / 2 + 10}" text-anchor="middle" font-family="Georgia, serif" font-size="${format === "sticker" ? 16 : 27}" font-weight="700" letter-spacing="3" fill="#E6BE60">${escapeSvgText(content.branchName.toUpperCase())}</text>
  <path d="M ${layout.width - 54} ${footerY + 34} C ${layout.width - 70} ${footerY + 16}, ${layout.width - 82} ${footerY + 21}, ${layout.width - 54} ${footerY + 40} C ${layout.width - 26} ${footerY + 21}, ${layout.width - 38} ${footerY + 16}, ${layout.width - 54} ${footerY + 34} C ${layout.width - 59} ${footerY + 51}, ${layout.width - 57} ${footerY + 61}, ${layout.width - 54} ${footerY + 68} C ${layout.width - 51} ${footerY + 61}, ${layout.width - 49} ${footerY + 51}, ${layout.width - 54} ${footerY + 34} Z" fill="#E6BE60"/>
</svg>`;
}
