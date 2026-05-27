import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import {
  PUBLIC_CATALOG_CATEGORY_NAMES,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";
import { resolveServiceImage } from "@/lib/service-images";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["service_categories"]["Row"],
  "id" | "name" | "display_order"
>;
type CategoryRelation = CategoryRow | CategoryRow[] | null;
type ServiceWithCategory = ServiceRow & {
  service_categories?: CategoryRelation;
};
type BranchServiceCatalogRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  | "service_id"
  | "is_active"
  | "custom_price"
  | "available_in_spa"
  | "available_home_service"
  | "booking_visibility"
>;
type LegacyBranchServiceCatalogRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  "service_id" | "is_active" | "custom_price"
>;

export type PublicCatalogService = {
  id: string;
  name: string;
  categoryName: string;
  categoryOrder: number;
  subcategory: string;
  description: string;
  durationMinutes: number;
  durationText: string;
  price: number;
  priceLabel: string;
  shortDescription: string;
  packagePax: number | null;
  packageDurationText: string | null;
  requiresConsultation: boolean;
  badges: string[];
  inclusions: string[];
  isPublicBookable: boolean;
  isCsrOnly: boolean;
  isVip: boolean;
  isCatalogOnly: boolean;
  availableInSpa: boolean;
  availableHomeService: boolean;
  imageUrl: string;
  imageAlt: string;
};

const DEFAULT_CATALOG_DESCRIPTION =
  "A Cradle service from the public wellness menu.";

function firstCategory(value: CategoryRelation | undefined): CategoryRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function metadataObject(value: Json | undefined): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }
  return {};
}

function metadataText(
  metadata: Record<string, Json>,
  key: string,
  fallback: string
): string {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function metadataBoolean(metadata: Record<string, Json>, key: string): boolean {
  return metadata[key] === true;
}

function metadataNumber(metadata: Record<string, Json>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataStringArray(
  metadata: Record<string, Json>,
  key: string
): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function isMissingBranchServiceCatalogColumnError(message: string) {
  const lower = message.toLowerCase();
  return (
    (lower.includes("booking_visibility") ||
      lower.includes("available_in_spa") ||
      lower.includes("available_home_service")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

export async function getAllCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(`*, service_categories ( id, name, display_order )`)
    .eq("is_active", true)
    .order("service_categories(display_order), name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllServicesForOwner() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(`*, service_categories ( id, name, display_order )`)
    .order("service_categories(display_order), name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getServiceById(serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*, service_categories (*)")
    .eq("id", serviceId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicServiceCatalog(): Promise<PublicCatalogService[]> {
  const supabase = await createClient();
  const [servicesResult, branchServicesResult] = await Promise.all([
    supabase
      .from("services")
      .select(`*, service_categories ( id, name, display_order )`)
      .eq("is_active", true)
      .order("service_categories(display_order), name"),
    supabase
      .from("branch_services")
      .select(
        "service_id, is_active, custom_price, available_in_spa, available_home_service, booking_visibility"
      ),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);

  let branchServicesData = (branchServicesResult.data ?? []) as BranchServiceCatalogRow[];
  if (branchServicesResult.error) {
    if (!isMissingBranchServiceCatalogColumnError(branchServicesResult.error.message)) {
      throw new Error(branchServicesResult.error.message);
    }

    const fallback = await supabase
      .from("branch_services")
      .select("service_id, is_active, custom_price");

    if (fallback.error) throw new Error(fallback.error.message);

    branchServicesData = ((fallback.data ?? []) as LegacyBranchServiceCatalogRow[]).map(
      (row) => ({
        ...row,
        available_in_spa: true,
        available_home_service: false,
        booking_visibility: "public",
      })
    );
  }

  const branchRowsByService = new Map<string, BranchServiceCatalogRow[]>();
  for (const row of branchServicesData) {
    const rows = branchRowsByService.get(row.service_id) ?? [];
    rows.push(row);
    branchRowsByService.set(row.service_id, rows);
  }

  const services = ((servicesResult.data ?? []) as ServiceWithCategory[]).map((service) => {
    const category = firstCategory(service.service_categories);
    const categoryName = category?.name ?? "Wellness";
    const metadata = metadataObject(service.metadata);
    const branchRows = (branchRowsByService.get(service.id) ?? []).filter((row) => row.is_active);
    const publicRows = branchRows.filter((row) => row.booking_visibility === "public");
    const isPublicBookable = publicRows.length > 0;
    const isCsrOnly =
      !isPublicBookable && branchRows.some((row) => row.booking_visibility === "csr_only");
    const isVip =
      !isPublicBookable && branchRows.some((row) => row.booking_visibility === "vip");
    const isCatalogOnly = branchRows.length === 0;
    const requiresConsultation =
      metadataBoolean(metadata, "requires_consultation") ||
      categoryName === "Spa Party Packages";
    const serviceImage = resolveServiceImage({
      id: service.id,
      name: service.name,
      imageUrl: service.image_url,
      imageAlt: service.image_alt,
    });

    return {
      id: service.id,
      name: service.name,
      categoryName,
      categoryOrder: category?.display_order ?? 999,
      subcategory: metadataText(metadata, "subcategory", "Services"),
      description: service.description ?? DEFAULT_CATALOG_DESCRIPTION,
      durationMinutes: service.duration_minutes,
      durationText: metadataText(metadata, "duration_text", `${service.duration_minutes} min`),
      price: Number(service.price),
      priceLabel: metadataText(metadata, "price_label", formatCurrency(Number(service.price))),
      shortDescription: metadataText(
        metadata,
        "public_short_description",
        service.description ?? DEFAULT_CATALOG_DESCRIPTION
      ),
      packagePax: metadataNumber(metadata, "package_pax"),
      packageDurationText: metadataText(metadata, "package_duration_text", ""),
      requiresConsultation,
      badges: metadataStringArray(metadata, "service_badges"),
      inclusions: metadataStringArray(metadata, "inclusions"),
      isPublicBookable,
      isCsrOnly,
      isVip,
      isCatalogOnly,
      availableInSpa: publicRows.some((row) => row.available_in_spa),
      availableHomeService: publicRows.some((row) => row.available_home_service),
      imageUrl: serviceImage.imageUrl,
      imageAlt: serviceImage.imageAlt,
    } satisfies PublicCatalogService;
  });

  const realCatalog = services.filter((service) =>
    PUBLIC_CATALOG_CATEGORY_NAMES.includes(service.categoryName as PublicCatalogCategoryName)
  );

  return realCatalog.length > 0 ? realCatalog : services;
}
