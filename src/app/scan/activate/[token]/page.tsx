import { PublicScanProcessor } from "@/components/features/attendance/public-scan-processor";

export default async function DeviceActivationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

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
      <PublicScanProcessor mode="activation" token={token} />
    </main>
  );
}
