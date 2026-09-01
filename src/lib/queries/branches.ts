import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cacheTags } from "@/lib/cache/cache-tags";
import {
  getBranchServiceCatalog,
  getBranchServiceCatalogCached,
} from "@/lib/services/service-catalog";

export async function getAllBranches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Public-facing branches (ordered for display) ───────────────────────────
// Cross-request cache (unstable_cache) + per-request dedup (React.cache).
// Busted by revalidateTag(cacheTags.publicBranches) after any branch mutation.
const _getPublicBranchesUncached = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["public-branches"],
  { tags: [cacheTags.publicBranches], revalidate: 3600 }
);
export const getPublicBranchesCached = cache(_getPublicBranchesUncached);

export async function getPublicBranches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBranchById(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBranchServices(
  branchId: string,
  options?: { publicOnly?: boolean }
) {
  return getBranchServiceCatalog(branchId, {
    audience: options?.publicOnly
      ? "public"
      : options?.publicOnly === false
        ? "crm"
        : "management",
  });
}

export async function getBranchServicesForManagement(branchId: string) {
  return getBranchServiceCatalog(branchId, {
    audience: "management",
    includeInactiveBranchRows: true,
    includeUnavailableDeliveryModes: true,
  });
}

// ── Branch with full detail (owner branch edit/detail page) ───────────────
// Returns everything the branch management page needs in one query:
// branch info + all services offered + all active staff.
// This avoids 3 separate calls from the UI.
export async function getBranchWithFullDetail(branchId: string) {
  const supabase = await createClient();

  const [branchResult, servicesResult, staffResult, resourcesResult] = await Promise.all([
    supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .single(),

    getBranchServicesForManagement(branchId),

    supabase
      .from("staff")
      .select("id, full_name, nickname, tier, system_role, phone, is_active")
      .eq("branch_id", branchId)
      .order("tier")
      .order("full_name"),

    supabase
      .from("branch_resources")
      .select("*")
      .eq("branch_id", branchId)
      .order("sort_order")
      .order("name"),
  ]);

  if (branchResult.error) throw new Error(branchResult.error.message);

  return {
    branch:    branchResult.data,
    services:  servicesResult ?? [],
    staff:     staffResult.data     ?? [],
    resources: resourcesResult.data ?? [],
  };
}

// ── All branches with live summary stats (owner overview list) ────────────
// Returns each branch with:
//   - active_staff_count: how many therapists are currently active
//   - todays_bookings: number of non-cancelled bookings for today
// Used to render branch summary cards on the owner overview page.
export async function getBranchesOverview() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  const [branchesResult, staffCounts, bookingCounts] = await Promise.all([
    // All branches (including inactive so owner can reactivate)
    supabase
      .from("branches")
      .select("*")
      .order("name"),

    // Active staff count per branch
    supabase
      .from("staff")
      .select("branch_id")
      .eq("is_active", true),

    // Today's non-cancelled bookings per branch
    supabase
      .from("bookings")
      .select("branch_id")
      .eq("booking_date", today)
      .not("status", "in", '("cancelled","no_show")'),
  ]);

  if (branchesResult.error) throw new Error(branchesResult.error.message);

  const branches = branchesResult.data ?? [];
  const staff = staffCounts.data ?? [];
  const bookings = bookingCounts.data ?? [];

  // Build lookup maps
  const staffByBranch = staff.reduce<Record<string, number>>((acc, s) => {
    acc[s.branch_id] = (acc[s.branch_id] ?? 0) + 1;
    return acc;
  }, {});

  const bookingsByBranch = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.branch_id] = (acc[b.branch_id] ?? 0) + 1;
    return acc;
  }, {});

  return branches.map((b) => ({
    ...b,
    active_staff_count: staffByBranch[b.id] ?? 0,
    todays_bookings: bookingsByBranch[b.id] ?? 0,
  }));
}

// ── Branch services — uncached public variant (used by booking-context API) ──
// Always hits the DB fresh. Used where CRM changes (home-service toggle,
// visibility) must be immediately visible to customers without waiting for
// cache invalidation.
export async function getBranchServicesForPublicBooking(branchId: string) {
  return getBranchServiceCatalog(branchId, {
    audience: "public",
    useAdminClient: true,
  });
}

// ── Branch services — public-only cached variant ──────────────────────────
// Uses admin client (no cookie dependency) so the result can be safely cached
// across requests. Only caches the publicOnly=true view used by the booking wizard.
// Busted by revalidateTag(cacheTags.branchServices(branchId)) after any service mutation.
export function getBranchServicesPublicCached(branchId: string) {
  return getBranchServiceCatalogCached(branchId, { audience: "public" });
}

// ── Branch slot config (used by booking flow) ─────────────────────────────
// Lightweight query — just what the booking flow needs to build the time grid.
export async function getBranchSlotConfig(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, slot_interval_minutes, is_active")
    .eq("id", branchId)
    .eq("is_active", true)
    .single();
  if (error) return null; // Branch not found or inactive
  return data;
}
