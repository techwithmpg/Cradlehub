/**
 * Shared Workspace Cached Queries
 *
 * Lightweight `unstable_cache` wrappers around high-traffic workspace queries.
 * These do NOT duplicate Supabase logic — they reuse the existing query
 * functions and add cross-request caching with tagged invalidation.
 *
 * Cache tags follow the convention established in `src/lib/cache/cache-tags.ts`:
 *   crm-workspace:{branchId}
 *   crm-bookings:{branchId}
 *   crm-dispatch:{branchId}
 *   crm-availability:{branchId}
 *   crm-setup:{branchId}
 *   manager-workspace:{branchId}
 *   owner-workspace:{branchId}
 *
 * After any mutation that affects CRM data, call:
 *   invalidateCrmWorkspace(branchId)
 *
 * This expires all CRM cache entries for that branch so the next request
 * fetches fresh data from Supabase.
 */

import { unstable_cache } from "next/cache";
import { cacheTags } from "@/lib/cache/cache-tags";
import { getCrmSetupHealth } from "./crm-setup";
import { getCrmTodaySnapshot } from "./crm-today";
import { getCrmAvailabilitySnapshot } from "./crm-availability";
import { getDispatchData } from "./dispatch-queries";

// ── Re-exports so callers can import types from one place ─────────────────────

export type { CrmTodaySnapshot } from "./crm-today";
export type { CrmAvailabilitySummary } from "./crm-availability";
export type { DispatchData, DispatchStats } from "./dispatch-queries";
export type { CrmSetupHealthData } from "./crm-setup";

// ── CRM Setup Health ──────────────────────────────────────────────────────────

export function getCrmSetupHealthCached(branchId: string) {
  return unstable_cache(
    () => getCrmSetupHealth(branchId),
    ["crm-setup-health", branchId],
    { tags: [cacheTags.crmSetup(branchId)], revalidate: 3600 }
  )();
}

// ── CRM Today Snapshot ────────────────────────────────────────────────────────

export function getCrmTodaySnapshotCached(branchId: string, date: string) {
  return unstable_cache(
    () => getCrmTodaySnapshot({ branchId, date }),
    ["crm-today-snapshot", branchId, date],
    { tags: [cacheTags.crmWorkspace(branchId), cacheTags.crmBookings(branchId)], revalidate: 3600 }
  )();
}

// ── CRM Availability Snapshot ─────────────────────────────────────────────────

export function getCrmAvailabilitySnapshotCached(branchId: string, date: string) {
  return unstable_cache(
    () => getCrmAvailabilitySnapshot({ branchId, date }),
    ["crm-availability-snapshot", branchId, date],
    { tags: [cacheTags.crmAvailability(branchId)], revalidate: 3600 }
  )();
}

// ── Dispatch Data ─────────────────────────────────────────────────────────────

export function getDispatchDataCached(branchId: string, date: string) {
  return unstable_cache(
    () => getDispatchData({ branchId, date }),
    ["crm-dispatch-data", branchId, date],
    { tags: [cacheTags.crmDispatch(branchId)], revalidate: 3600 }
  )();
}
