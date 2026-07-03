import { toast } from "sonner";
import { buildQrFilename } from "@/lib/attendance/qr-filenames";
import { buildQrPrintSvg, type QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

export function buildSelectedQrSignSvg(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}): string {
  return buildQrPrintSvg(
    {
      label: params.point.label,
      pointType: params.point.point_type,
      qrSvg: params.point.svg,
      branchName: params.branchName,
    },
    params.format
  );
}

function downloadBlob(filename: string, type: string, body: BlobPart) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadQrSvg(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  downloadBlob(
    buildQrFilename({ qrPoint: params.point, format: params.format, extension: "svg" }),
    "image/svg+xml",
    buildSelectedQrSignSvg(params)
  );
}

export async function downloadQrPng(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  const svg = buildSelectedQrSignSvg(params);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("QR image could not be rendered."));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("QR image could not be exported.");
  downloadBlob(buildQrFilename({ qrPoint: params.point, format: params.format, extension: "png" }), "image/png", blob);
}

export function printQrPoint(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>${params.point.label}</title><style>body{margin:0;display:grid;place-items:center;background:#fff}</style></head><body>${buildSelectedQrSignSvg(params)}<script>window.print();</script></body></html>`);
  printWindow.document.close();
}

export function printQrPoints(params: {
  points: AttendanceQrPoint[];
  branchName: string;
  format: QrPrintFormat;
}) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!printWindow) {
    toast.error("Pop-up blocked. Allow pop-ups to print selected QR signs.");
    return;
  }

  const signs = params.points
    .map((point) => `<section class="qr-page">${buildSelectedQrSignSvg({ point, branchName: params.branchName, format: params.format })}</section>`)
    .join("");

  printWindow.document.write(`<html><head><title>Selected QR signs</title><style>
    body{margin:0;background:#fff}
    .qr-page{min-height:100vh;display:grid;place-items:center;break-after:page;padding:24px;box-sizing:border-box}
    .qr-page:last-child{break-after:auto}
    svg{max-width:100%;height:auto}
  </style></head><body>${signs}<script>window.print();</script></body></html>`);
  printWindow.document.close();
}

export async function copyQrScanLink(point: AttendanceQrPoint) {
  if (!point.scan_url) {
    toast.error("Scan link is unavailable until APP_URL or NEXT_PUBLIC_APP_URL is configured.");
    return;
  }
  await navigator.clipboard.writeText(point.scan_url);
  toast.success("Scan link copied.");
}
