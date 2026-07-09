import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateExtraDistanceKm,
  calculateHomeServiceTravelFee,
  haversineDistanceKm,
  type Coordinates,
} from "@/lib/home-service/distance-fee";
import { calculateDrivingDistanceKm } from "@/lib/maps/google-maps";

export type HomeServiceDistanceSource = "google_driving" | "haversine_estimate";

export type HomeServiceDistanceQuote = {
  branchId: string;
  branchName: string;
  distanceKm: number;
  distanceSource: HomeServiceDistanceSource;
  freeKm: number;
  extraKm: number;
  feePerExtraKm: number;
  travelFee: number;
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
  home_service_free_km?: number | string | null;
  home_service_extra_km_fee?: number | string | null;
};

export const DEFAULT_HOME_SERVICE_FREE_KM = 5;
export const DEFAULT_HOME_SERVICE_EXTRA_KM_FEE = 100;

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
}): Promise<
  | { ok: true; quote: HomeServiceDistanceQuote }
  | { ok: false; code: "BRANCH_NOT_FOUND" | "BRANCH_LOCATION_MISSING"; message: string }
> {
  const admin = createAdminClient();
  const [{ data: branchData, error: branchError }, { data: rulesData }] = await Promise.all([
    admin
      .from("branches")
      .select("*")
      .eq("id", params.branchId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("branch_booking_rules")
      .select("*")
      .eq("branch_id", params.branchId)
      .maybeSingle(),
  ]);

  if (branchError || !branchData) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "The selected branch could not be found.",
    };
  }

  const branch = branchData as unknown as BranchDistanceRow;
  const origin = resolveBranchCoordinates(branch);
  if (!origin) {
    return {
      ok: false,
      code: "BRANCH_LOCATION_MISSING",
      message:
        "Branch location coordinates are not configured. Update the selected branch service address before calculating Home Service distance.",
    };
  }

  const rules = (rulesData ?? {}) as BranchDistanceRulesRow;
  const freeKm = numberOrNull(rules.home_service_free_km) ?? DEFAULT_HOME_SERVICE_FREE_KM;
  const feePerExtraKm =
    numberOrNull(rules.home_service_extra_km_fee) ?? DEFAULT_HOME_SERVICE_EXTRA_KM_FEE;

  const googleDistanceKm = await calculateDrivingDistanceKm(
    origin.lat,
    origin.lng,
    params.destination.lat,
    params.destination.lng
  );
  const distanceSource: HomeServiceDistanceSource =
    googleDistanceKm === null ? "haversine_estimate" : "google_driving";
  const distanceKm =
    googleDistanceKm ?? haversineDistanceKm(origin, params.destination);
  const extraKm = calculateExtraDistanceKm(distanceKm, freeKm);
  const travelFee = calculateHomeServiceTravelFee(distanceKm, freeKm, feePerExtraKm);

  return {
    ok: true,
    quote: {
      branchId: branch.id,
      branchName: branch.name,
      distanceKm,
      distanceSource,
      freeKm,
      extraKm,
      feePerExtraKm,
      travelFee,
      warning:
        distanceSource === "haversine_estimate"
          ? "Distance is estimated. Please confirm before booking."
          : undefined,
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
    home_service_free_km: params.quote.freeKm,
    home_service_extra_km: params.quote.extraKm,
    home_service_extra_km_fee: params.quote.feePerExtraKm,
    home_service_travel_fee: params.quote.travelFee,
    travel_fee_applied_to_booking: params.travelFeeAppliedToBooking,
    total: params.serviceSubtotal + params.quote.travelFee,
  };
}
