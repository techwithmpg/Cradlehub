"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { displayQrScanLink, formatQrInfoDateTime } from "@/components/features/attendance/qr-codes/qr-display";
import type { AttendanceQrPoint, AttendanceScanEvent } from "@/lib/attendance/types";

export function QrInformationCard({
  qrPoint,
  scanEvents,
}: {
  qrPoint: AttendanceQrPoint;
  scanEvents: AttendanceScanEvent[];
}) {
  async function copyFullLink() {
    if (!qrPoint.scan_url) {
      toast.error("Scan link is unavailable until APP_URL or NEXT_PUBLIC_APP_URL is configured.");
      return;
    }
    await navigator.clipboard.writeText(qrPoint.scan_url);
    toast.success("Scan link copied.");
  }

  return (
    <div className="grid h-fit gap-3 rounded-lg border border-border bg-background p-3 text-sm">
      <div className="font-bold">QR Information</div>
      <div className="grid gap-1">
        <span className="text-xs font-semibold text-muted-foreground">Public Link</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 break-words text-sm leading-5">{displayQrScanLink(qrPoint)}</span>
          <button type="button" aria-label="Copy full scan link" disabled={!qrPoint.scan_url} className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void copyFullLink()}>
            <Copy className="size-3.5" />
          </button>
        </div>
      </div>
      <Info label="Created" value={formatQrInfoDateTime(qrPoint.created_at)} />
      <Info label="Created By" value="Maria Vitalis" />
      <Info label="Total Scans" value={`${scanEvents.filter((event) => event.point_label === qrPoint.label).length} scans`} />
      <Info label="QR Code" value={`v2 (${qrPoint.is_active ? "Active" : "Inactive"})`} />
      <Info label="Last printed" value={formatQrInfoDateTime(qrPoint.updated_at)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="break-words text-sm leading-5">{value}</span>
    </div>
  );
}
