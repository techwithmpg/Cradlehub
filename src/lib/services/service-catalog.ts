import "server-only";

import { unstable_cache } from "next/cache";
import { cacheTags } from "@/lib/cache/cache-tags";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  isAssignableBranchService,
  isDeliveryModeEnabled,
  isVisibleForAudience,
  normalizeBranchServiceRow,
  validateBranchServiceEligibility as validatePureBranchServiceEligibility,
} from "./service-eligibility";
import type {
  BranchServiceCatalogRow,
  BranchServiceProviderReadiness,
  ServiceAudience,
  ServiceDeliveryMode,
} from "./service-types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type SupabaseReadClient = SupabaseServerClient | SupabaseAdminClient;

export type ServiceProfileRow =
  Database["public"]["Tables"]["services"]["Row"] & {
    service_categories: { id: string; name: string } | null;
  };

export type BranchServiceCatalogOptions = {
  audience?: ServiceAudience;
  deliveryMode?: ServiceDeliveryMode;
  includeInactiveBranchRows?: boolean;
  includeUnavailableDeliveryModes?: boolean;
  useAdminClient?: boolean;
};

const BRANCH_SERVICES_MODERN_SELECT = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  booking_visibility,
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
    category_id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    image_url,
    image_alt,
    created_at,
    updated_at,
    service_categories ( id, name, display_order )
  )
`;

const BRANCH_SERVICES_CORE_SELECT = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  visibility,
  booking_visibility,
  public_title,
  public_description,
  custom_duration_minutes,
  custom_image_url,
  services (
    id,
    category_id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    image_url,
    image_alt,
    created_at,
    updated_at,
    service_categories ( id, name, display_order )
  )
`;

const BRANCH_SERVICES_LEGACY_SELECT = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  available_in_spa,
  available_home_service,
  booking_visibility,
  services (
    id,
    category_id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    image_url,
    image_alt,
    created_at,
    updated_at,
    service_categories ( id, name, display_order )
  )
`;

const BRANCH_SERVICES_MINIMAL_SELECT = `
  id,
  branch_id,
  service_id,
  custom_price,
  is_active,
  services (
    id,
    category_id,
    name,
    description,
    is_active,
    duration_minutes,
    price,
    metadata,
    buffer_before,
    buffer_after,
    image_url,
    image_alt,
    created_at,
    updated_at,
    service_categories ( id, name, display_order )
  )
`;

function isMissingBranchServiceColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("sort_order") ||
      lower.includes("is_featured") ||
      lower.includes("customer_tier_required") ||
      lower.includes("requires_senior_staff") ||
      lower.includes("requires_special_setup") ||
      lower.includes("setup_notes") ||
      lower.includes("booking_visibility") ||
      lower.includes("visibility") ||
      lower.includes("public_title") ||
      lower.includes("public_description") ||
      lower.includes("custom_duration_minutes") ||
      lower.includes("custom_image_url") ||
      lower.includes("available_in_spa") ||
      lower.includes("available_home_service") ||
      lower.includes("image_url") ||
      lower.includes("image_alt")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function firstService(row: BranchServiceCatalogRow) {
  return firstRelation(row.services);
}

function firstCategory(service: NonNullable<ReturnType<typeof firstService>>) {
  return firstRelation(service.service_categories);
}

async function resolveClient(useAdminClient?: boolean): Promise<SupabaseReadClient> {
  return useAdminClient ? createAdminClient() : createClient();
}

async function queryBranchServices(
  client: SupabaseReadClient,
  branchId: string,
  includeInactiveBranchRows: boolean
): Promise<BranchServiceCatalogRow[]> {
  let modernQuery = client
    .from("branch_services")
    .select(BRANCH_SERVICES_MODERN_SELECT)
    .eq("branch_id", branchId);
  if (!includeInactiveBranchRows) {
    modernQuery = modernQuery.eq("is_active", true);
  }
  const modern = await modernQuery
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (!modern.error) {
    return ((modern.data ?? []) as unknown[])
      .map((row) => normalizeBranchServiceRow(row as Record<string, unknown>))
      .map((row) => row as unknown as BranchServiceCatalogRow);
  }

  if (!isMissingBranchServiceColumnError(modern.error.message)) {
    throw new Error(modern.error.message);
  }

  const selects = [
    BRANCH_SERVICES_CORE_SELECT,
    BRANCH_SERVICES_LEGACY_SELECT,
    BRANCH_SERVICES_MINIMAL_SELECT,
  ];

  for (const select of selects) {
    let query = client
      .from("branch_services")
      .select(select)
      .eq("branch_id", branchId)
      .order("id", { ascending: true });
    if (!includeInactiveBranchRows) query = query.eq("is_active", true);

    const result = await query;
    if (!result.error) {
      return ((result.data ?? []) as unknown[])
        .map((row) => normalizeBranchServiceRow(row as Record<string, unknown>))
        .map((row) => row as unknown as BranchServiceCatalogRow);
    }
    if (!isMissingBranchServiceColumnError(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  return [];
}

export async function getMasterServiceCatalog(options?: {
  includeInactive?: boolean;
  useAdminClient?: boolean;
}): Promise<ServiceProfileRow[]> {
  const client = await resolveClient(options?.useAdminClient);
  let query = client
    .from("services")
    .select("*, service_categories ( id, name, display_order )")
    .order("service_categories(display_order), name");
  if (!options?.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ServiceProfileRow[];
}

export async function getBranchServiceCatalog(
  branchId: string,
  options: BranchServiceCatalogOptions = {}
): Promise<BranchServiceCatalogRow[]> {
  const audience = options.audience ?? "management";
  const deliveryMode = options.deliveryMode ?? "any";
  const client = await resolveClient(options.useAdminClient);
  const rules = await getBranchBookingRulesOrDefault(branchId);
  const rows = await queryBranchServices(
    client,
    branchId,
    options.includeInactiveBranchRows === true
  );

  return rows.filter((row) => {
    const service = firstService(row);
    if (!service?.is_active) return false;
    if (!options.includeInactiveBranchRows && !row.is_active) return false;
    if (!isVisibleForAudience(row.visibility, audience)) return false;
    if (
      !options.includeUnavailableDeliveryModes &&
      !isDeliveryModeEnabled(row, deliveryMode, rules)
    ) {
      return false;
    }
    return true;
  });
}

export function getBranchServiceCatalogCached(
  branchId: string,
  options: Omit<BranchServiceCatalogOptions, "useAdminClient"> = {}
) {
  return unstable_cache(
    () =>
      getBranchServiceCatalog(branchId, {
        ...options,
        useAdminClient: true,
      }),
    [
      "branch-service-catalog",
      branchId,
      options.audience ?? "management",
      options.deliveryMode ?? "any",
      String(options.includeInactiveBranchRows === true),
      String(options.includeUnavailableDeliveryModes === true),
    ],
    { tags: [cacheTags.branchServices(branchId)], revalidate: 300 }
  )();
}

export async function getBranchAssignableServices(
  branchId: string,
  options?: { useAdminClient?: boolean }
): Promise<BranchServiceCatalogRow[]> {
  const client = await resolveClient(options?.useAdminClient);
  const [rules, rows] = await Promise.all([
    getBranchBookingRulesOrDefault(branchId),
    queryBranchServices(client, branchId, false),
  ]);

  return rows.filter((row) =>
    isAssignableBranchService({
      service: firstService(row),
      branchService: row,
      rules,
    })
  );
}

export async function getAssignableServicesForStaff(
  staffId: string,
  options?: { useAdminClient?: boolean }
): Promise<ServiceProfileRow[]> {
  const client = await resolveClient(options?.useAdminClient);
  const { data: staff, error } = await client
    .from("staff")
    .select("id, branch_id")
    .eq("id", staffId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!staff?.branch_id) return [];

  const branchServices = await getBranchAssignableServices(staff.branch_id, options);
  return branchServicesToServiceProfileRows(branchServices);
}

export async function validateBranchServiceEligibility(input: {
  branchId: string;
  serviceIds: string[];
  audience: ServiceAudience;
  deliveryMode: ServiceDeliveryMode;
  useAdminClient?: boolean;
}): Promise<{
  ok: boolean;
  invalidServiceIds: string[];
  results: Record<string, ReturnType<typeof validatePureBranchServiceEligibility>>;
}> {
  const uniqueServiceIds = Array.from(new Set(input.serviceIds));
  if (uniqueServiceIds.length === 0) {
    return { ok: true, invalidServiceIds: [], results: {} };
  }

  const client = await resolveClient(input.useAdminClient);
  const [rules, servicesResult, branchRows] = await Promise.all([
    getBranchBookingRulesOrDefault(input.branchId),
    client
      .from("services")
      .select("id, is_active")
      .in("id", uniqueServiceIds),
    queryBranchServices(client, input.branchId, true),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);

  const servicesById = new Map(
    ((servicesResult.data ?? []) as Array<{ id: string; is_active: boolean | null }>).map(
      (service) => [service.id, service]
    )
  );
  const branchRowsByServiceId = new Map(
    branchRows.map((row) => [row.service_id, row])
  );
  const results: Record<
    string,
    ReturnType<typeof validatePureBranchServiceEligibility>
  > = {};

  for (const serviceId of uniqueServiceIds) {
    results[serviceId] = validatePureBranchServiceEligibility({
      service: servicesById.get(serviceId),
      branchService: branchRowsByServiceId.get(serviceId),
      audience: input.audience,
      deliveryMode: input.deliveryMode,
      rules,
    });
  }

  const invalidServiceIds = Object.entries(results)
    .filter(([, result]) => !result.ok)
    .map(([serviceId]) => serviceId);

  return { ok: invalidServiceIds.length === 0, invalidServiceIds, results };
}

export async function getBranchProviderReadiness(
  branchId: string,
  serviceIds?: string[]
): Promise<BranchServiceProviderReadiness[]> {
  const admin = createAdminClient();
  const branchServices = await getBranchAssignableServices(branchId, {
    useAdminClient: true,
  });
  const scopedServiceIds = new Set(serviceIds ?? branchServices.map((row) => row.service_id));
  const targetServiceIds = branchServices
    .map((row) => row.service_id)
    .filter((serviceId) => scopedServiceIds.has(serviceId));

  if (targetServiceIds.length === 0) return [];

  const { data: staffRows, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .is("archived_at", null)
    .is("merged_into_staff_id", null);
  if (staffError) throw new Error(staffError.message);

  const staffIds = (staffRows ?? []).map((staff) => staff.id);
  if (staffIds.length === 0) {
    return targetServiceIds.map((serviceId) => ({
      serviceId,
      providerCount: 0,
      needsStaffAssignment: true,
    }));
  }

  const { data: assignments, error: assignmentError } = await admin
    .from("staff_services")
    .select("staff_id, service_id")
    .in("service_id", targetServiceIds)
    .in("staff_id", staffIds);
  if (assignmentError) throw new Error(assignmentError.message);

  const providersByService = new Map<string, Set<string>>();
  for (const assignment of assignments ?? []) {
    const providers = providersByService.get(assignment.service_id) ?? new Set<string>();
    providers.add(assignment.staff_id);
    providersByService.set(assignment.service_id, providers);
  }

  return targetServiceIds.map((serviceId) => {
    const providerCount = providersByService.get(serviceId)?.size ?? 0;
    return {
      serviceId,
      providerCount,
      needsStaffAssignment: providerCount === 0,
    };
  });
}

export async function synchronizeBranchServiceCatalog(options: {
  serviceId: string;
}): Promise<{ branchIds: string[] }> {
  const admin = createAdminClient();
  const { data: branches, error: branchesError } = await admin
    .from("branches")
    .select("id")
    .eq("is_active", true);

  if (branchesError) throw new Error(branchesError.message);

  const branchIds = (branches ?? []).map((branch) => branch.id);
  if (branchIds.length === 0) return { branchIds: [] };

  const { error } = await admin.from("branch_services").upsert(
    branchIds.map((branchId) => ({
      branch_id: branchId,
      service_id: options.serviceId,
      custom_price: null,
      is_active: true,
      available_in_spa: true,
      available_home_service: false,
      visibility: "public",
      booking_visibility: "public",
    })),
    { onConflict: "branch_id,service_id", ignoreDuplicates: true }
  );

  if (error) throw new Error(error.message);
  return { branchIds };
}

export function branchServicesToServiceProfileRows(
  branchServices: BranchServiceCatalogRow[]
): ServiceProfileRow[] {
  const rows: ServiceProfileRow[] = [];
  const seen = new Set<string>();

  for (const branchService of branchServices) {
    const service = firstService(branchService);
    if (!service || seen.has(service.id)) continue;
    seen.add(service.id);

    const category = firstCategory(service);
    rows.push({
      ...service,
      name: branchService.public_title?.trim() || service.name,
      description:
        branchService.public_description?.trim() || service.description,
      duration_minutes:
        branchService.custom_duration_minutes ?? service.duration_minutes,
      price: branchService.custom_price ?? service.price,
      service_categories: category
        ? { id: category.id, name: category.name }
        : null,
    } as unknown as ServiceProfileRow);
  }

  return rows;
}
