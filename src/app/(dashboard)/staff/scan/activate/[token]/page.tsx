/**
 * Staff-scoped activation adapter — PWA-GOV-009 / C6
 *
 * Receives a token decoded from the Staff PWA scanner and delegates
 * to the existing device-activation handler at /scan/activate/{token}.
 *
 * This route is a pure redirect seam. No mutation is performed here.
 * The existing DeviceRecoveryScreen (at /scan/activate/[token]) owns all
 * token-preview and activation logic.
 *
 * Raw opaque recovery tokens (32-byte hex without a prefix) are accepted
 * here only when they arrive via the explicit Staff-scoped path — meaning
 * the routing seam already validated them as containing the act_ prefix or
 * being embedded in an approved URL before delegating here.
 */
import { redirect } from "next/navigation";

export default async function StaffScanActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  if (!decoded.trim()) {
    redirect("/staff");
  }

  // Delegate to the existing subsystem handler
  redirect(`/scan/activate/${encodeURIComponent(decoded)}`);
}
