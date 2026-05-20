import { revalidateTag as nextRevalidateTag } from "next/cache";

export const cacheTags = {
  publicBranches: "public-branches",
  branchBookingRules: (branchId: string) => `branch-booking-rules:${branchId}`,
  branchServices: (branchId: string) => `branch-services:${branchId}`,
} as const;

// Next.js 16 revalidateTag requires a second profile argument (for the "use cache" system).
// Service/settings writes must be visible on the next public booking request, so expire
// matching entries immediately instead of serving a stale response while revalidating.
export function invalidateTag(tag: string): void {
  nextRevalidateTag(tag, { expire: 0 });
}
