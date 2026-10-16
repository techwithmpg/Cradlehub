import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateHomeServiceTravelFeeBreakdown,
  type Coordinates,
  type HomeServiceTransportSnapshot,
} from "@/lib/home-service/distance-fee";
import { calculateDrivingDistanceKm } from "@/lib/maps/google-maps";

export type { HomeServiceTransportSnapshot } from "@/lib/home-service/distance-fee";

export type HomeServiceDistanceSource = "google_driving";

export type HomeServiceDistanceQuote = {
  branchId: string;
  branchName: string;
  distanceKm: number;
  drivingDistanceKm: number;
  distanceSource: HomeServiceDistanceSource;
  baseFee: number;
  includedKm: number;
  perKmFee: number;
  billableDistanceKm: number;
  rawFee: number;
  travelFee: number;
  transportSnapshot: HomeServiceTransportSnapshot;
  // Backward compatibility fields
  freeKm: number;
  extraKm: number;
  feePerExtraKm: number;
  warning?: string;
};

type BranchDistanceRow = {
  id: string;
  name: string;
  is_active: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  maps_embed_url?: string | null;
};

type BranchDistanceRulesRow = {
  home_service_base_fee?: number | string | null;
  home_service_free_km?: number | string | null;
  home_service_extra_km_fee?: number | string | null;
};

export const DEFAULT_HOME_SERVICE_BASE_FEE = 100;
export const DEFAULT_HOME_SERVICE_INCLUDED_KM = 1;
export const DEFAULT_HOME_SERVICE_PER_KM_FEE = 40;

// Legacy aliases
export const DEFAULT_HOME_SERVICE_FREE_KM = DEFAULT_HOME_SERVICE_INCLUDED_KM;
export const DEFAULT_HOME_SERVICE_EXTRA_KM_FEE = DEFAULT_HOME_SERVICE_PER_KM_FEE;

export const HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE =
  "We couldn't calculate the transportation fee right now. Please try again or contact the branch.";

function numberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCoordinatesFromMapsUrl(value: string | null | undefined): Coordinates | null {
  if (!value) return null;
  const match = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(value);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function resolveBranchCoordinates(branch: BranchDistanceRow): Coordinates | null {
  const lat = numberOrNull(branch.latitude);
  const lng = numberOrNull(branch.longitude);

  if (lat !== null && lng !== null) return { lat, lng };
  return parseCoordinatesFromMapsUrl(branch.maps_embed_url);
}

export async function calculateHomeServiceDistanceQuote(params: {
  branchId: string;
  destination: Coordinates;
  client?: unknown;
}): Promise<
  | { ok: true; quote: HomeServiceDistanceQuote }
  | {
      ok: false;
      code: "BRANCH_NOT_FOUND" | "BRANCH_LOCATION_MISSING" | "HOME_SERVICE_DISTANCE_UNAVAILABLE";
      message: string;
    }
> {
  if (
    !params.destination ||
    typeof params.destination.lat !== "number" ||
    !Number.isFinite(params.destination.lat) ||
    typeof params.destination.lng !== "number" ||
    !Number.isFinite(params.destination.lng)
  ) {
    return {
      ok: false,
      code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
      message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
    };
  }

  const admin = (params.client as ReturnType<typeof createAdminClient> | undefined) ?? createAdminClient();
  const [{ data: branchData, error: branchError }, { data: rulesData, error: rulesError }] =
    await Promise.all([
      admin
        .from("branches")
        .select("*")
        .eq("id", params.branchId)
        .eq("is_active", true)
        .maybeSingle(),
      admin.from("branch_booking_rules").select("*").eq("branch_id", params.branchId).maybeSingle(),
    ]);

  if (branchError || !branchData) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "The selected branch could not be found.",
    };
  }

  // If the pricing-rules query fails (database / query error), fail closed.
  // Do NOT silently substitute runtime defaults after a database/query failure.
  if (rulesError) {
    return {
      ok: false,
      code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
      message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
    };
  }

  const branch = branchData as unknown as BranchDistanceRow;
  const origin = resolveBranchCoordinates(branch);
  if (!origin) {
    return {
      ok: false,
      code: "BRANCH_LOCATION_MISSING",
      message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
    };
  }

  const googleDistanceKm = await calculateDrivingDistanceKm(
    origin.lat,
    origin.lng,
    params.destination.lat,
    params.destination.lng
  );

  // Financial distance authority MUST be Google Routes driving distance. Fail closed if unavailable.
  if (googleDistanceKm === null) {
    return {
      ok: false,
      code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
      message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
    };
  }

  let baseFee = DEFAULT_HOME_SERVICE_BASE_FEE;
  let includedKm = DEFAULT_HOME_SERVICE_INCLUDED_KM;
  let perKmFee = DEFAULT_HOME_SERVICE_PER_KM_FEE;

  if (rulesData) {
    const rules = rulesData as unknown as BranchDistanceRulesRow;

    if (rules.home_service_base_fee !== undefined && rules.home_service_base_fee !== null) {
      const parsed = numberOrNull(rules.home_service_base_fee);
      if (parsed === null || parsed < 0) {
        return {
          ok: false,
          code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
          message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
        };
      }
      baseFee = parsed;
    }

    if (rules.home_service_free_km !== undefined && rules.home_service_free_km !== null) {
      const parsed = numberOrNull(rules.home_service_free_km);
      if (parsed === null || parsed < 0) {
        return {
          ok: false,
          code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
          message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
        };
      }
      includedKm = parsed;
    }

    if (rules.home_service_extra_km_fee !== undefined && rules.home_service_extra_km_fee !== null) {
      const parsed = numberOrNull(rules.home_service_extra_km_fee);
      if (parsed === null || parsed < 0) {
        return {
          ok: false,
          code: "HOME_SERVICE_DISTANCE_UNAVAILABLE",
          message: HOME_SERVICE_DISTANCE_UNAVAILABLE_MESSAGE,
        };
      }
      perKmFee = parsed;
    }
  }

  const breakdown = calculateHomeServiceTravelFeeBreakdown({
    drivingDistanceKm: googleDistanceKm,
    baseFee,
    includedKm,
    perKmFee,
  });

  return {
    ok: true,
    quote: {
      branchId: branch.id,
      branchName: branch.name,
      distanceKm: googleDistanceKm,
      drivingDistanceKm: googleDistanceKm,
      distanceSource: "google_driving",
      baseFee,
      includedKm,
      perKmFee,
      billableDistanceKm: breakdown.billableDistanceKm,
      rawFee: breakdown.rawFee,
      travelFee: breakdown.finalFee,
      transportSnapshot: breakdown.snapshot,
      freeKm: includedKm,
      extraKm: breakdown.billableDistanceKm,
      feePerExtraKm: perKmFee,
    },
  };
}

export function buildHomeServicePricingBreakdown(params: {
  serviceSubtotal: number;
  serviceLinePrice: number;
  quote: HomeServiceDistanceQuote;
  travelFeeAppliedToBooking: boolean;
}) {
  return {
    service_subtotal: params.serviceSubtotal,
    service_line_price: params.serviceLinePrice,
    home_service_distance_km: params.quote.distanceKm,
    home_service_distance_source: params.quote.distanceSource,
    home_service_base_fee: params.quote.baseFee,
    home_service_included_km: params.quote.includedKm,
    home_service_per_km_fee: params.quote.perKmFee,
    home_service_billable_distance_km: params.quote.billableDistanceKm,
    home_service_raw_fee: params.quote.rawFee,
    home_service_calculated_fee: params.quote.travelFee,
    home_service_free_km: params.quote.includedKm,
    home_service_extra_km: params.quote.billableDistanceKm,
    home_service_extra_km_fee: params.quote.perKmFee,
    home_service_travel_fee: params.quote.travelFee,
    home_service_transport: params.quote.transportSnapshot,
    travel_fee_applied_to_booking: params.travelFeeAppliedToBooking,
    total: params.serviceSubtotal + params.quote.travelFee,
  };
}

export async function getHomeServiceBranchRouteOrigin(
  branchId: string,
  options?: { client?: ReturnType<typeof createAdminClient>; throwOnError?: boolean }
): Promise<{
  branchId: string;
  branchName: string;
  lat: number;
  lng: number;
} | null> {
  const admin = options?.client ?? createAdminClient();

  const { data: branchData, error } = await admin
    .from("branches")
    .select("id, name, is_active, latitude, longitude, maps_embed_url")
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && options?.throwOnError) throw error;
  if (error || !branchData) return null;

  const branch = branchData as unknown as BranchDistanceRow;
  const origin = resolveBranchCoordinates(branch);
  if (!origin) return null;

  return {
    branchId: branch.id,
    branchName: branch.name,
    lat: origin.lat,
    lng: origin.lng,
  };
}
