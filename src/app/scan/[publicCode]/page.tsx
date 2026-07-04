import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";

export default async function PublicQrScanPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;

  return (
    <main className="min-h-svh bg-[#f3f0ea] sm:grid sm:place-items-center sm:p-6">
      <PublicScanProcessor mode="scan" publicCode={publicCode} />
    </main>
  );
}
