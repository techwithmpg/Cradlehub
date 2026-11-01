import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";
import { attendanceGeofenceRequired } from "@/lib/attendance/geofence-server";
import { classifyPublicQr } from "@/lib/scanner/classify-public-qr";

export const dynamic = "force-dynamic";

export default async function PublicQrScanPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;
  const qrType = await classifyPublicQr(publicCode);

  return (
    <main className="min-h-svh bg-[#f3f0ea] sm:grid sm:place-items-center sm:p-6">
      <PublicScanProcessor
        mode="scan"
        publicCode={publicCode}
        qrType={qrType}
        locationRequired={attendanceGeofenceRequired()}
      />
    </main>
  );
}
