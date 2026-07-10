import { Info } from "lucide-react";
import { StatusPill } from "@/components/features/attendance/attendance-ui";
import { QrActionSidebar } from "@/components/features/attendance/qr-codes/qr-action-sidebar";
import { formatLastScanned, getLatestScanEvent, getQrPointSubtitle, getQrPointTypeLabel } from "@/components/features/attendance/qr-codes/qr-display";
import { QrPrintTemplate } from "@/components/features/attendance/qr-codes/qr-print-template";
import type { QrPrintFormat, QrPrintLayout } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint, AttendanceScanEvent } from "@/lib/attendance/types";

export function QrSelectedPanel({
  qrPoint,
  branchName,
  scanEvents,
  nowMs,
  format,
  formatOptions,
  isPending,
  urlActionsDisabled,
  onFormatChange,
  onDeactivate,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  scanEvents: AttendanceScanEvent[];
  nowMs: number;
  format: QrPrintFormat;
  formatOptions: QrPrintLayout[];
  isPending: boolean;
  urlActionsDisabled: boolean;
  onFormatChange: (format: QrPrintFormat) => void;
  onDeactivate: (point: AttendanceQrPoint) => void;
}) {
  const latestScan = formatLastScanned(getLatestScanEvent(qrPoint, scanEvents)?.created_at, nowMs);

  return (
    <section className="cs-card grid min-w-0 content-start gap-4 rounded-lg p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="m-0 truncate text-[1rem] font-bold text-foreground">{qrPoint.label}</h2>
            <StatusPill value={getQrPointTypeLabel(qrPoint)} tone={qrPoint.point_type === "attendance" ? "good" : "neutral"} />
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{getQrPointSubtitle(qrPoint)} <span aria-hidden="true">&middot;</span> {branchName}</div>
        </div>
        <div className="grid gap-2 text-sm sm:justify-items-end">
          <span className="inline-flex items-center gap-2 font-semibold text-[#0B5634]">
            <span className="size-1.5 rounded-full bg-[#0B5634]" />
            {qrPoint.is_active ? "Active" : "Inactive"}
          </span>
          <span className="text-muted-foreground">Last scanned: {latestScan.full}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[220px] gap-1 text-sm font-semibold">
          <span className="text-[11px] font-medium text-muted-foreground">Format</span>
          <select value={format} onChange={(event) => onFormatChange(event.target.value as QrPrintFormat)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-semibold shadow-sm">
            {formatOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-stone-50 px-3 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          <span>Recommended for walls<br className="hidden sm:block" /> and large displays</span>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,1fr)_232px]">
        <QrPrintTemplate qrPoint={qrPoint} branchName={branchName} format={format} />
        <QrActionSidebar
          qrPoint={qrPoint}
          branchName={branchName}
          scanEvents={scanEvents}
          format={format}
          isPending={isPending}
          urlActionsDisabled={urlActionsDisabled}
          onDeactivate={onDeactivate}
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-700/20 bg-[#FFF7E8] px-3 py-2 text-sm text-amber-900">
        <Info className="size-4 shrink-0" />
        <span>Tip: For best results, print on matte or semi-gloss paper with high contrast.</span>
      </div>
    </section>
  );
}
