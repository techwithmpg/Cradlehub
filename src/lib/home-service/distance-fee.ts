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
  if (!Number.isFinite(value)) {
    throw new HomeServiceDistanceError(`${label} must be a finite number.`);
  }
}

export function calculateExtraDistanceKm(distanceKm: number, freeKm: number): number {
  assertFiniteNumber(distanceKm, "distanceKm");
  assertFiniteNumber(freeKm, "freeKm");

  if (distanceKm < 0) {
    throw new HomeServiceDistanceError("distanceKm cannot be negative.");
  }
  if (freeKm < 0) {
    throw new HomeServiceDistanceError("freeKm cannot be negative.");
  }

  return distanceKm <= freeKm ? 0 : Math.ceil(distanceKm - freeKm);
}

export function calculateHomeServiceTravelFee(
  distanceKm: number,
  freeKm: number,
  feePerExtraKm: number
): number {
  assertFiniteNumber(feePerExtraKm, "feePerExtraKm");
  if (feePerExtraKm < 0) {
    throw new HomeServiceDistanceError("feePerExtraKm cannot be negative.");
  }

  return calculateExtraDistanceKm(distanceKm, freeKm) * feePerExtraKm;
}

export function formatDistanceKm(distanceKm: number): string {
  assertFiniteNumber(distanceKm, "distanceKm");
  if (distanceKm < 0) {
    throw new HomeServiceDistanceError("distanceKm cannot be negative.");
  }

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
