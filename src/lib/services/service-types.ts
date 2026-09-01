import type { Database } from "@/types/supabase";

export type ServiceAudience = "public" | "crm" | "management" | "staff_assignment";

export type ServiceDeliveryMode = "in_spa" | "home_service" | "any";

export type CanonicalVisibility = "public" | "internal" | "hidden";
export type LegacyBookingVisibility = "public" | "csr_only" | "vip";

export type BranchBookingRulesLike = {
  homeServiceEnabled?: boolean | null;
};

export type ServiceCategoryRelation =
  | Pick<Database["public"]["Tables"]["service_categories"]["Row"], "id" | "name" | "display_order">
  | Array<
      Pick<
        Database["public"]["Tables"]["service_categories"]["Row"],
        "id" | "name" | "display_order"
      >
    >
  | null;

export type MasterServiceRelation =
  | (Database["public"]["Tables"]["services"]["Row"] & {
      service_categories?: ServiceCategoryRelation;
    })
  | Array<
      Database["public"]["Tables"]["services"]["Row"] & {
        service_categories?: ServiceCategoryRelation;
      }
    >
  | null;

export type BranchServiceCatalogRow = {
  id: string;
  branch_id: string;
  service_id: string;
  custom_price: number | string | null;
  is_active: boolean;
  available_in_spa: boolean;
  available_home_service: boolean;
  visibility: CanonicalVisibility;
  booking_visibility: LegacyBookingVisibility;
  customer_tier_required?: string | null;
  requires_senior_staff?: boolean | null;
  requires_special_setup?: boolean | null;
  setup_notes?: string | null;
  sort_order?: number | null;
  public_title?: string | null;
  public_description?: string | null;
  custom_duration_minutes?: number | null;
  custom_image_url?: string | null;
  is_featured?: boolean | null;
  services: MasterServiceRelation;
};

export type BranchServiceEligibilityReason =
  | "global_inactive"
  | "branch_missing"
  | "branch_inactive"
  | "not_visible_to_audience"
  | "delivery_mode_unavailable";

export type BranchServiceEligibilityResult =
  | { ok: true }
  | { ok: false; reasons: BranchServiceEligibilityReason[] };

export type BranchServiceProviderReadiness = {
  serviceId: string;
  providerCount: number;
  needsStaffAssignment: boolean;
};
