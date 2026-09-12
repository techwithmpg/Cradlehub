"use server";

import { resolveStaffScanTarget } from "@/lib/scanner/resolve-scan-target";

/** Transport normalization only; downstream subsystems authorize all operations. */
export async function resolveStaffScanTargetAction(raw: string) {
  return resolveStaffScanTarget(raw);
}
