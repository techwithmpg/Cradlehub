/**
 * Staff-scoped public-scan adapter — PWA-GOV-009 / C6
 *
 * Receives a publicCode decoded from the Staff PWA scanner and delegates
 * to the existing subsystem handler at /scan/{publicCode}.
 *
 * This route is a pure redirect seam. No mutation is performed here.
 * The existing PublicScanProcessor (at /scan/[publicCode]) owns all
 * attendance/room/resource resolution logic.
 */
import { redirect } from "next/navigation";

export default async function StaffScanProcessPage({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;

  // Validate the publicCode segment: must be a non-empty string with a
  // known prefix. The routing seam already validated the prefix before
  // delegating here, but we re-verify to be defensive.
  const KNOWN_PREFIXES = ["att_", "room_", "res_"];
  const decoded = decodeURIComponent(publicCode);

  const isKnown = KNOWN_PREFIXES.some((prefix) => decoded.startsWith(prefix));
  if (!isKnown || !decoded.trim()) {
    redirect("/staff");
  }

  // Delegate to the existing subsystem handler
  redirect(`/scan/${encodeURIComponent(decoded)}`);
}
