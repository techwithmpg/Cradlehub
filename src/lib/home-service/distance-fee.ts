export type Coordinates = {
  lat: number;
  lng: number;
};

export class HomeServiceDistanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HomeServiceDistanceError";
  }
}

function assertFiniteNumber(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HomeServiceDistanceError(`${label} must be a finite number.`);
  }
}

function assertNonNegativeNumber(value: number, label: string): void {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new HomeServiceDistanceError(`${label} cannot be negative.`);
  }
}

export type HomeServicePricingInput = {
  drivingDistanceKm: number;
  baseFee: number;
  includedKm: number;
  perKmFee: number;
};

export type HomeServiceTransportSnapshot = {
  pricing_version: 1;
  distance_source: "google_routes";
  driving_distance_km: number;
  base_fee: number;
  included_km: number;
  per_km_fee: number;
  billable_distance_km: number;
  raw_fee: number;
  calculated_fee: number;
};

export type HomeServiceFeeCalculation = {
  pricingVersion: 1;
  distanceSource: "google_routes";
  drivingDistanceKm: number;
  baseFee: number;
  includedKm: number;
  perKmFee: number;
  billableDistanceKm: number;
  rawFee: number;
  finalFee: number;
  snapshot: HomeServiceTransportSnapshot;
};

export function calculateHomeServiceTravelFeeBreakdown(
  params: HomeServicePricingInput
): HomeServiceFeeCalculation {
  assertNonNegativeNumber(params.drivingDistanceKm, "drivingDistanceKm");
  assertNonNegativeNumber(params.baseFee, "baseFee");
  assertNonNegativeNumber(params.includedKm, "includedKm");
  assertNonNegativeNumber(params.perKmFee, "perKmFee");

  const billableDistanceKm = Math.max(0, params.drivingDistanceKm - params.includedKm);
  const rawFee = params.baseFee + params.perKmFee * billableDistanceKm;
  const finalFee = Math.round(rawFee);

  const snapshot: HomeServiceTransportSnapshot = {
    pricing_version: 1,
    distance_source: "google_routes",
    driving_distance_km: params.drivingDistanceKm,
    base_fee: params.baseFee,
    included_km: params.includedKm,
    per_km_fee: params.perKmFee,
    billable_distance_km: billableDistanceKm,
    raw_fee: rawFee,
    calculated_fee: finalFee,
  };

  return {
    pricingVersion: 1,
    distanceSource: "google_routes",
    drivingDistanceKm: params.drivingDistanceKm,
    baseFee: params.baseFee,
    includedKm: params.includedKm,
    perKmFee: params.perKmFee,
    billableDistanceKm,
    rawFee,
    finalFee,
    snapshot,
  };
}

export function calculateHomeServiceTravelFee(
  params: HomeServicePricingInput
): number;
export function calculateHomeServiceTravelFee(
  distanceKm: number,
  freeKm?: number,
  feePerExtraKm?: number,
  baseFee?: number
): number;
export function calculateHomeServiceTravelFee(
  arg1: HomeServicePricingInput | number,
  arg2?: number,
  arg3?: number,
  arg4?: number
): number {
  if (typeof arg1 === "object" && arg1 !== null) {
    return calculateHomeServiceTravelFeeBreakdown(arg1).finalFee;
  }
  return calculateHomeServiceTravelFeeBreakdown({
    drivingDistanceKm: arg1,
    baseFee: arg4 ?? 100,
    includedKm: arg2 ?? 1,
    perKmFee: arg3 ?? 40,
  }).finalFee;
}

export function calculateExtraDistanceKm(
  distanceKm: number,
  includedKm: number
): number {
  assertNonNegativeNumber(distanceKm, "distanceKm");
  assertNonNegativeNumber(includedKm, "includedKm");
  return Math.max(0, distanceKm - includedKm);
}

export function formatDistanceKm(distanceKm: number): string {
  assertNonNegativeNumber(distanceKm, "distanceKm");
  return `${distanceKm.toFixed(1)} km`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function assertCoordinates(value: Coordinates, label: string): void {
  assertFiniteNumber(value.lat, `${label}.lat`);
  assertFiniteNumber(value.lng, `${label}.lng`);

  if (value.lat < -90 || value.lat > 90) {
    throw new HomeServiceDistanceError(`${label}.lat must be between -90 and 90.`);
  }
  if (value.lng < -180 || value.lng > 180) {
    throw new HomeServiceDistanceError(`${label}.lng must be between -180 and 180.`);
  }
}

export function haversineDistanceKm(origin: Coordinates, destination: Coordinates): number {
  assertCoordinates(origin, "origin");
  assertCoordinates(destination, "destination");

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function createHomeServiceTransportSnapshot({
  drivingDistanceKm,
  baseFee,
  includedKm,
  perKmFee,
  distanceSource = "google_routes",
}: {
  drivingDistanceKm: number;
  baseFee: number;
  includedKm: number;
  perKmFee: number;
  distanceSource?: "google_routes";
}): HomeServiceTransportSnapshot {
  const breakdown = calculateHomeServiceTravelFeeBreakdown({
    drivingDistanceKm,
    baseFee,
    includedKm,
    perKmFee,
  });

  return {
    pricing_version: 1,
    distance_source: distanceSource,
    driving_distance_km: drivingDistanceKm,
    base_fee: breakdown.baseFee,
    included_km: breakdown.includedKm,
    per_km_fee: breakdown.perKmFee,
    billable_distance_km: breakdown.billableDistanceKm,
    raw_fee: breakdown.rawFee,
    calculated_fee: breakdown.finalFee,
  };
}
