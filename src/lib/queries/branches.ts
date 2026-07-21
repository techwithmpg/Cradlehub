import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cacheTags } from "@/lib/cache/cache-tags";

function isMissingBranchServiceColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (// Optional modern columns (may not exist in all deployed schemas)
      lower.includes("sort_order") ||
      lower.includes("is_featured") ||
      lower.includes("customer_tier_required") ||
      lower.includes("requires_senior_staff") ||
      lower.includes("requires_special_setup") ||
      lower.includes("setup_notes") ||
      // Legacy column name for visibility (replaced by `visibility` column)
      lower.includes("booking_visibility") ||
      // Older schemas that never had image or metadata columns
      lower.includes("image_url") ||
      lower.includes("image_alt") ||
      lower.includes("public_title") ||
      lower.includes("public_description") ||
      lower.includes("custom_duration_minutes") ||
      lower.includes("custom_image_url") ||
      // Visibility (very old schemas before visibility column)
      lower.includes("visibility") ||
      // Eligibility flags (very old schemas before eligibility migration)
      lower.includes("available_in_spa") ||
      lower.includes("available_home_service")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

const branchServicesManagementSelect = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  customer_tier_required,
  requires_senior_staff,
  requires_special_setup,
  setup_notes,
  sort_order,
  public_title,
  public_description,
  custom_duration_minutes,
  custom_image_url,
  is_featured,
  services (
    id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    service_categories ( id, name, display_order )
  )
`;

const branchServicesPublicModernSelect = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  sort_order,
  public_title,
  public_description,
  custom_duration_minutes,
  custom_image_url,
  is_featured,
  services (
    id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    service_categories ( id, name, display_order )
  )
`;

const branchServicesLegacySelect = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  services (
    id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    service_categories ( id, name, display_order )
  )
`;

// ── Core select: columns confirmed in current production schema ─────────────
// Falls back to this when the modern select fails due to optional columns
// (sort_order, is_featured, booking_visibility) being absent.
// Crucially includes available_home_service and visibility so the
// public booking wizard can correctly filter home-service services.
const branchServicesCoreSelect = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  public_title,
  public_description,
  custom_duration_minutes,
  custom_image_url,
  services (
    id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    service_categories ( id, name, display_order )
  )
`;

const branchServicesMinimalSelect = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  services (
    id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    service_categories ( id, name, display_order )
  )
`;

type NormalizedBranchServiceVisibility<T> = T & {
  booking_visibility: string;
  available_in_spa: boolean;
  available_home_service: boolean;
  visibility?: string;
};

function normalizeBranchServiceVisibility<T extends Record<string, unknown>>(
  rows: T[]
): Array<NormalizedBranchServiceVisibility<T>> {
  return rows.map((row) => {
    const record = row;
    const visibility =
      typeof record.visibility === "string" ? record.visibility : null;
    const bookingVisibility =
      typeof record.booking_visibility === "string"
        ? record.booking_visibility
        : visibility ?? "public";

    return {
      ...record,
      ...(visibility ? { visibility } : {}),
      booking_visibility: bookingVisibility,
      available_in_spa:
        typeof record.available_in_spa === "boolean"
          ? record.available_in_spa
          : true,
      available_home_service:
        typeof record.available_home_service === "boolean"
          ? record.available_home_service
          : false,
    } satisfies NormalizedBranchServiceVisibility<T>;
  });
}

function isPublicBranchService(row: unknown): boolean {
  const record = row as Record<string, unknown>;
  const visibility =
    typeof record.visibility === "string"
      ? record.visibility
      : typeof record.booking_visibility === "string"
        ? record.booking_visibility
        : "public";

  return visibility === "public";
}

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
  const supabase = await createClient();

  const modern = await supabase
    .from("branch_services")
    .select(branchServicesPublicModernSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (!modern.error) {
    const rows = normalizeBranchServiceVisibility(modern.data ?? []);
    return options?.publicOnly ? rows.filter(isPublicBranchService) : rows;
  }

  if (!isMissingBranchServiceColumnError(modern.error.message)) {
    throw new Error(modern.error.message);
  }

  // Core: confirmed schema columns — available_home_service + visibility, no sort_order
  const core = await supabase
    .from("branch_services")
    .select(branchServicesCoreSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (!core.error) {
    const rows = normalizeBranchServiceVisibility(core.data ?? []);
    return options?.publicOnly ? rows.filter(isPublicBranchService) : rows;
  }

  if (!isMissingBranchServiceColumnError(core.error.message)) {
    throw new Error(core.error.message);
  }

  const legacy = await supabase
    .from("branch_services")
    .select(branchServicesLegacySelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (!legacy.error) {
    const rows = normalizeBranchServiceVisibility(legacy.data ?? []);
    return options?.publicOnly ? rows.filter(isPublicBranchService) : rows;
  }

  if (!isMissingBranchServiceColumnError(legacy.error.message)) {
    throw new Error(legacy.error.message);
  }

  const minimal = await supabase
    .from("branch_services")
    .select(branchServicesMinimalSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (minimal.error) throw new Error(minimal.error.message);

  const rows = normalizeBranchServiceVisibility(minimal.data ?? []);
  return options?.publicOnly ? rows.filter(isPublicBranchService) : rows;
}

export async function getBranchServicesForManagement(branchId: string) {
  const supabase = await createClient();

  const modern = await supabase
    .from("branch_services")
    .select(branchServicesManagementSelect)
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (!modern.error) {
    return normalizeBranchServiceVisibility(modern.data ?? []);
  }

  if (!isMissingBranchServiceColumnError(modern.error.message)) {
    throw new Error(modern.error.message);
  }

  // Core: confirmed schema columns (available_home_service + visibility, no sort_order)
  const core = await supabase
    .from("branch_services")
    .select(branchServicesCoreSelect)
    .eq("branch_id", branchId)
    .order("id", { ascending: true });

  if (!core.error) {
    return normalizeBranchServiceVisibility(core.data ?? []);
  }

  if (!isMissingBranchServiceColumnError(core.error.message)) {
    throw new Error(core.error.message);
  }

  const legacy = await supabase
    .from("branch_services")
    .select(branchServicesLegacySelect)
    .eq("branch_id", branchId)
    .order("id", { ascending: true });

  if (!legacy.error) {
    return normalizeBranchServiceVisibility(legacy.data ?? []);
  }

  if (!isMissingBranchServiceColumnError(legacy.error.message)) {
    throw new Error(legacy.error.message);
  }

  const minimal = await supabase
    .from("branch_services")
    .select(branchServicesMinimalSelect)
    .eq("branch_id", branchId)
    .order("id", { ascending: true });

  if (minimal.error) throw new Error(minimal.error.message);
  return normalizeBranchServiceVisibility(minimal.data ?? []);
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
  const supabase = createAdminClient();

  // ── Step 1: full modern select (sort_order, is_featured, all columns) ────
  const modern = await supabase
    .from("branch_services")
    .select(branchServicesPublicModernSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (!modern.error) {
    return normalizeBranchServiceVisibility(modern.data ?? []).filter(isPublicBranchService);
  }

  if (!isMissingBranchServiceColumnError(modern.error.message)) {
    throw new Error(modern.error.message);
  }

  // ── Step 2: core select (confirmed current schema — no sort_order/booking_visibility)
  // Crucially includes available_home_service and visibility.
  const core = await supabase
    .from("branch_services")
    .select(branchServicesCoreSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (!core.error) {
    return normalizeBranchServiceVisibility(core.data ?? []).filter(isPublicBranchService);
  }

  if (!isMissingBranchServiceColumnError(core.error.message)) {
    throw new Error(core.error.message);
  }

  // ── Step 3: legacy select (booking_visibility, no visibility column) ─────
  const legacy = await supabase
    .from("branch_services")
    .select(branchServicesLegacySelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (!legacy.error) {
    return normalizeBranchServiceVisibility(legacy.data ?? []).filter(isPublicBranchService);
  }

  if (!isMissingBranchServiceColumnError(legacy.error.message)) {
    throw new Error(legacy.error.message);
  }

  // ── Step 4: absolute minimum (very old schemas, no eligibility columns) ──
  const fallback = await supabase
    .from("branch_services")
    .select(branchServicesMinimalSelect)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id");

  if (fallback.error) throw new Error(fallback.error.message);
  return normalizeBranchServiceVisibility(fallback.data ?? []).filter(isPublicBranchService);
}

// ── Branch services — public-only cached variant ──────────────────────────
// Uses admin client (no cookie dependency) so the result can be safely cached
// across requests. Only caches the publicOnly=true view used by the booking wizard.
// Busted by revalidateTag(cacheTags.branchServices(branchId)) after any service mutation.
export function getBranchServicesPublicCached(branchId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // Primary: current branch-services shape used by the admin service table.
      // Some deployed databases use `visibility`; older migrations used
      // `booking_visibility`, so filter in memory after normalization.
      const modern = await supabase
        .from("branch_services")
        .select(branchServicesPublicModernSelect)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (!modern.error) {
        return normalizeBranchServiceVisibility(modern.data ?? []).filter(
          isPublicBranchService
        );
      }

      if (!isMissingBranchServiceColumnError(modern.error.message)) {
        throw new Error(modern.error.message);
      }

      const legacy = await supabase
        .from("branch_services")
        .select(branchServicesLegacySelect)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("id", { ascending: true });

      if (!legacy.error) {
        return normalizeBranchServiceVisibility(legacy.data ?? []).filter(
          isPublicBranchService
        );
      }

      if (!isMissingBranchServiceColumnError(legacy.error.message)) {
        throw new Error(legacy.error.message);
      }

      // Last-resort legacy fallback for databases before visibility and
      // visit-type eligibility columns existed.
      const fallback = await supabase
        .from("branch_services")
        .select(branchServicesMinimalSelect)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("id");

      if (fallback.error) throw new Error(fallback.error.message);
      return normalizeBranchServiceVisibility(fallback.data ?? []).filter(
        isPublicBranchService
      );
    },
    ["branch-services", branchId],
    { tags: [cacheTags.branchServices(branchId)], revalidate: 300 }
  )();
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
