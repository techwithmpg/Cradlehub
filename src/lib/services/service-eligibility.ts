import type {
  BranchBookingRulesLike,
  BranchServiceCatalogRow,
  BranchServiceEligibilityReason,
  BranchServiceEligibilityResult,
  CanonicalVisibility,
  LegacyBookingVisibility,
  ServiceAudience,
  ServiceDeliveryMode,
} from "./service-types";

type BranchServiceFlags = Pick<
  BranchServiceCatalogRow,
  "is_active" | "available_in_spa" | "available_home_service" | "visibility" | "booking_visibility"
>;

type ServiceActiveFlag = { is_active?: boolean | null } | null | undefined;

export function normalizeServiceVisibility(input: {
  visibility?: string | null;
  bookingVisibility?: string | null;
}): CanonicalVisibility {
  if (
    input.visibility === "public" ||
    input.visibility === "internal" ||
    input.visibility === "hidden"
  ) {
    return input.visibility;
  }

  if (input.bookingVisibility === "csr_only") return "internal";
  if (input.bookingVisibility === "vip") return "hidden";
  return "public";
}

export function toLegacyBookingVisibility(
  visibility: CanonicalVisibility
): LegacyBookingVisibility {
  if (visibility === "internal") return "csr_only";
  if (visibility === "hidden") return "vip";
  return "public";
}

export function isVisibleForAudience(
  visibility: CanonicalVisibility,
  audience: ServiceAudience
): boolean {
  switch (audience) {
    case "public":
      return visibility === "public";
    case "crm":
      return visibility === "public" || visibility === "internal";
    case "management":
    case "staff_assignment":
      return true;
  }
}

export function isDeliveryModeEnabled(
  branchService: Pick<BranchServiceFlags, "available_in_spa" | "available_home_service">,
  deliveryMode: ServiceDeliveryMode,
  rules: BranchBookingRulesLike | null | undefined
): boolean {
  if (deliveryMode === "in_spa") return branchService.available_in_spa;

  const homeServiceEnabled = rules?.homeServiceEnabled === true;
  if (deliveryMode === "home_service") {
    return homeServiceEnabled && branchService.available_home_service;
  }

  return (
    branchService.available_in_spa || (homeServiceEnabled && branchService.available_home_service)
  );
}

export function isBranchCatalogueMember(input: {
  service: ServiceActiveFlag;
  branchService: Pick<BranchServiceFlags, "is_active"> | null | undefined;
}): boolean {
  return input.service?.is_active === true && input.branchService?.is_active === true;
}

export function isAssignableBranchService(input: {
  service: ServiceActiveFlag;
  branchService: BranchServiceFlags | null | undefined;
  rules: BranchBookingRulesLike | null | undefined;
}): boolean {
  const branchService = input.branchService;
  if (
    !branchService ||
    !isBranchCatalogueMember({
      service: input.service,
      branchService,
    })
  ) {
    return false;
  }
  return isDeliveryModeEnabled(branchService, "any", input.rules);
}

export function validateBranchServiceEligibility(input: {
  service: ServiceActiveFlag;
  branchService: BranchServiceFlags | null | undefined;
  audience: ServiceAudience;
  deliveryMode: ServiceDeliveryMode;
  rules: BranchBookingRulesLike | null | undefined;
}): BranchServiceEligibilityResult {
  const reasons: BranchServiceEligibilityReason[] = [];

  if (input.service?.is_active !== true) reasons.push("global_inactive");
  if (!input.branchService) reasons.push("branch_missing");
  else if (!input.branchService.is_active) reasons.push("branch_inactive");

  if (input.branchService) {
    if (!isVisibleForAudience(input.branchService.visibility, input.audience)) {
      reasons.push("not_visible_to_audience");
    }
    if (!isDeliveryModeEnabled(input.branchService, input.deliveryMode, input.rules)) {
      reasons.push("delivery_mode_unavailable");
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function normalizeBranchServiceRow<T extends Record<string, unknown>>(
  row: T
): T & {
  available_in_spa: boolean;
  available_home_service: boolean;
  visibility: CanonicalVisibility;
  booking_visibility: LegacyBookingVisibility;
} {
  const visibility = normalizeServiceVisibility({
    visibility: typeof row.visibility === "string" ? row.visibility : null,
    bookingVisibility: typeof row.booking_visibility === "string" ? row.booking_visibility : null,
  });

  return {
    ...row,
    available_in_spa: typeof row.available_in_spa === "boolean" ? row.available_in_spa : true,
    available_home_service:
      typeof row.available_home_service === "boolean" ? row.available_home_service : false,
    visibility,
    booking_visibility: toLegacyBookingVisibility(visibility),
  };
}
