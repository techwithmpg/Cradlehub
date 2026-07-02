import { buildQrPrintSvg, type QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import { cn } from "@/lib/utils";
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
  const svg = buildQrPrintSvg(
    {
      label: qrPoint.label,
      pointType: qrPoint.point_type,
      qrSvg: qrPoint.svg,
      branchName,
    },
    format
  );

  return (
    <div
      className={cn("mx-auto w-full max-w-[430px] overflow-hidden rounded-lg border border-amber-700/20 bg-[#FCF7EC] shadow-sm [&_svg]:block [&_svg]:h-auto [&_svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
