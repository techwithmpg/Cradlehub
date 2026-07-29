import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { QrPrintDocument } from "@/components/features/attendance/qr-codes/qr-print-poster";
import { getCradleQrPrintCss } from "@/components/features/attendance/qr-codes/qr-print-styles";
import { buildQrFilename } from "@/lib/attendance/qr-filenames";
import {
  buildQrPrintSvg,
  toQrPrintPoint,
  type QrPrintFormat,
} from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

export function buildSelectedQrSignSvg(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}): string {
  return buildQrPrintSvg(toQrPrintPoint(params.point, params.branchName), params.format);
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
  downloadBlob(
    buildQrFilename({ qrPoint: params.point, format: params.format, extension: "png" }),
    "image/png",
    blob
  );
}

function openPrintWindow(title: string): Window | null {
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) return null;
  printWindow.opener = null;
  printWindow.document.title = title;
  const viewport = printWindow.document.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  const style = printWindow.document.createElement("style");
  printWindow.document.head.append(viewport, style);
  return printWindow;
}

async function waitForPrintAssets(printWindow: Window) {
  await new Promise<void>((resolve) => printWindow.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => printWindow.requestAnimationFrame(() => resolve()));

  const images = Array.from(printWindow.document.images);
  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error("A QR image failed to load in print preview.")),
          { once: true }
        );
      });
    })
  );

  await printWindow.document.fonts?.ready;
}

export function printQrPoints(params: {
  points: readonly AttendanceQrPoint[];
  branchName: string;
  format: QrPrintFormat;
}) {
  if (params.points.length === 0) {
    toast.error("Select a QR point to print.");
    return;
  }

  const title =
    params.points.length === 1
      ? `${params.points[0]?.label ?? "QR"} sign`
      : `${params.branchName} QR signs`;
  const printWindow = openPrintWindow(title);
  if (!printWindow) {
    toast.error("Pop-up blocked. Allow pop-ups to open the QR print preview.");
    return;
  }

  const style = printWindow.document.head.querySelector("style");
  if (!style) {
    toast.error("The QR print preview could not be prepared.");
    printWindow.close();
    return;
  }
  style.textContent = getCradleQrPrintCss(params.format);
  const root = createRoot(printWindow.document.body);
  root.render(
    <QrPrintDocument points={params.points} branchName={params.branchName} format={params.format} />
  );

  void waitForPrintAssets(printWindow)
    .then(() => {
      printWindow.focus();
      printWindow.print();
    })
    .catch((error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "The QR print preview could not be prepared."
      );
    });
}

export function printQrPoint(params: {
  point: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
}) {
  printQrPoints({ points: [params.point], branchName: params.branchName, format: params.format });
}

export async function copyQrScanLink(point: AttendanceQrPoint) {
  if (!point.scan_url) {
    toast.error("Scan link is unavailable until APP_URL or NEXT_PUBLIC_APP_URL is configured.");
    return;
  }
  await navigator.clipboard.writeText(point.scan_url);
  toast.success("Scan link copied.");
}
