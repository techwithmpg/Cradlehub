import { CradleQrPoster } from "@/components/features/attendance/qr-codes/qr-print-poster";
import { getCradleQrPrintCss } from "@/components/features/attendance/qr-codes/qr-print-styles";
import { cn } from "@/lib/utils";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

export function QrPrintTemplate({
  qrPoint,
  branchName,
  format,
  className,
}: {
  qrPoint: AttendanceQrPoint;
  branchName: string;
  format: QrPrintFormat;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[430px] overflow-hidden rounded-lg border border-amber-700/20 bg-[#FCF7EC] shadow-sm",
        className
      )}
    >
      <style>{getCradleQrPrintCss(format)}</style>
      <CradleQrPoster qrPoint={qrPoint} branchName={branchName} format={format} />
    </div>
  );
}
