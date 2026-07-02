import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";

export default async function PublicQrScanPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;

  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        background: "#f8fafc",
      }}
    >
      <PublicScanProcessor mode="scan" publicCode={publicCode} />
    </main>
  );
}
