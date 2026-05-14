import { revalidateTag as nextRevalidateTag } from "next/cache";

export const cacheTags = {
  publicBranches: "public-branches",
  branchBookingRules: (branchId: string) => `branch-booking-rules:${branchId}`,
  branchServices: (branchId: string) => `branch-services:${branchId}`,
} as const;

// Next.js 16 revalidateTag requires a second profile argument (for the "use cache" system).
// We pass an empty CacheLifeConfig ({}) which means: no additional expiry constraint.
// This correctly invalidates both unstable_cache and "use cache" entries sharing the tag.
export function invalidateTag(tag: string): void {
  nextRevalidateTag(tag, {});
}
