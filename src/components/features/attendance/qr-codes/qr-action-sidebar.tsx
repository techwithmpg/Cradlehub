import { Copy, Download, Power, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QrInformationCard } from "@/components/features/attendance/qr-codes/qr-information-card";
import { copyQrScanLink, downloadQrPng, downloadQrSvg, printQrPoint } from "@/components/features/attendance/qr-codes/qr-export-client";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint, AttendanceScanEvent } from "@/lib/attendance/types";

export function QrActionSidebar({
  qrPoint,
  branchName,
  scanEvents,
  format,
  isPending,
  onDeactivate,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  scanEvents: AttendanceScanEvent[];
  format: QrPrintFormat;
  isPending: boolean;
  onDeactivate: (point: AttendanceQrPoint) => void;
}) {
  async function handlePngDownload() {
    try {
      await downloadQrPng({ point: qrPoint, branchName, format });
    } catch {
      toast.error("PNG export failed. Try SVG or print instead.");
    }
  }

  return (
    <aside className="grid h-fit gap-3">
      <Button type="button" size="lg" className="h-10 w-full justify-start bg-[#0B5634] text-white hover:bg-[#0A482D]" onClick={() => void handlePngDownload()}>
        <Download data-icon="inline-start" />
        Download PNG
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-10 w-full justify-start" onClick={() => downloadQrSvg({ point: qrPoint, branchName, format })}>
        <Download data-icon="inline-start" />
        Download SVG
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-10 w-full justify-start" onClick={() => printQrPoint({ point: qrPoint, branchName, format })}>
        <Printer data-icon="inline-start" />
        Download Print PDF
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-10 w-full justify-start" onClick={() => void copyQrScanLink(qrPoint)}>
        <Copy data-icon="inline-start" />
        Copy Scan Link
      </Button>

      <QrInformationCard qrPoint={qrPoint} scanEvents={scanEvents} />

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending || !qrPoint.is_active}
        className="h-10 w-full justify-center border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => onDeactivate(qrPoint)}
      >
        <Power data-icon="inline-start" />
        Deactivate QR
      </Button>
    </aside>
  );
}
