import { DeviceRecoveryScreen } from "@/components/features/attendance/device-recovery-screen";
import { getRecoveryTokenPreview } from "@/lib/attendance/device-recovery";

export default async function DeviceActivationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getRecoveryTokenPreview(token);

  return (
    <main className="grid min-h-svh place-items-center bg-[#F8F3EA] p-4">
      <DeviceRecoveryScreen token={token} preview={preview} />
    </main>
  );
}
