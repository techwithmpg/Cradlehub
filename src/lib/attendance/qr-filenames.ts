import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function buildQrFilename(params: {
  qrPoint: Pick<AttendanceQrPoint, "label" | "point_type">;
  format: QrPrintFormat;
  extension: "png" | "svg" | "pdf" | "zip";
}): string {
  const label = slugify(params.qrPoint.label) || "qr-point";
  return `cradlehub-${params.qrPoint.point_type}-${label}-${params.format}.${params.extension}`;
}
