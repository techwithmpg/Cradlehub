import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

export function automaticDriverCandidate(
  currentDriverId: string | null,
  drivers: ScoredStaff[]
): string | null {
  if (currentDriverId) return null;
  return drivers.find((driver) => driver.status === "recommended")?.staffId ?? null;
}
