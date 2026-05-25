import { revalidateTag as nextRevalidateTag } from "next/cache";

export const cacheTags = {
  publicBranches: "public-branches",
  branchBookingRules: (branchId: string) => `branch-booking-rules:${branchId}`,
  branchServices: (branchId: string) => `branch-services:${branchId}`,

  // ── Workspace readiness / summary caches ───────────────────────────────────
  crmWorkspace: (branchId: string) => `crm-workspace:${branchId}`,
  crmBookings: (branchId: string) => `crm-bookings:${branchId}`,
  crmDispatch: (branchId: string) => `crm-dispatch:${branchId}`,
  crmAvailability: (branchId: string) => `crm-availability:${branchId}`,
  crmSetup: (branchId: string) => `crm-setup:${branchId}`,

  managerWorkspace: (branchId: string) => `manager-workspace:${branchId}`,
  ownerWorkspace: (branchId: string) => `owner-workspace:${branchId}`,
} as const;

// Next.js 16 revalidateTag requires a second profile argument (for the "use cache" system).
// Service/settings writes must be visible on the next public booking request, so expire
// matching entries immediately instead of serving a stale response while revalidating.
export function invalidateTag(tag: string): void {
  nextRevalidateTag(tag, { expire: 0 });
}

// ── Batch invalidation helpers ────────────────────────────────────────────────

/**
 * Invalidate all CRM workspace tags for a branch after any booking,
 * dispatch, staff, or payment mutation.
 */
export function invalidateCrmWorkspace(branchId: string): void {
  invalidateTag(cacheTags.crmWorkspace(branchId));
  invalidateTag(cacheTags.crmBookings(branchId));
  invalidateTag(cacheTags.crmDispatch(branchId));
  invalidateTag(cacheTags.crmAvailability(branchId));
  invalidateTag(cacheTags.crmSetup(branchId));
}

/**
 * Invalidate manager workspace tags for a branch.
 */
export function invalidateManagerWorkspace(branchId: string): void {
  invalidateTag(cacheTags.managerWorkspace(branchId));
}

/**
 * Invalidate owner workspace tags for a branch.
 */
export function invalidateOwnerWorkspace(branchId: string): void {
  invalidateTag(cacheTags.ownerWorkspace(branchId));
}
