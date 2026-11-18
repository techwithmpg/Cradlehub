import { timeToMinutes } from "@/lib/engine/slot-time";

export const MIN_SAFETY_HOME_BUFFER_MINUTES = 15;
export const DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES = 30;
export const DEFAULT_ROOM_RESET_BUFFER_MINUTES = 10;

export type DynamicBufferInput = {
  deliveryType: "in_spa" | "home_service";
  bookingStartTime: string;
  bookingEndTime: string;
  bufferBeforeMinutes?: number | null;
  bufferAfterMinutes?: number | null;
  branchTravelBufferMinutes?: number | null;
  schedulingHomeBufferMinutes?: number | null;
  bookingTravelBufferMinutes?: number | null;
  liveEtaMinutes?: number | null;
  distanceKm?: number | null;
  collectionDecision?: "required" | "not_required" | "undecided" | null;
  isPeakHour?: boolean;
};

export type DynamicBufferOutput = {
  preBufferMinutes: number;
  postBufferMinutes: number;
  effectiveStartMinute: number;
  effectiveEndMinute: number;
  bufferSource: "live_traffic" | "maps_matrix" | "distance_fallback" | "branch_rule_fallback";
  configuredRuleBufferMinutes: number;
  note: string;
};

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

export function isPeakTrafficHour(startMinute: number): boolean {
  const wrapped = ((startMinute % 1440) + 1440) % 1440;
  // Bacolod urban rush peaks: 11:30–13:30 and 16:30–20:00
  return (wrapped >= 690 && wrapped <= 810) || (wrapped >= 990 && wrapped <= 1200);
}

export function computeDynamicTransitionBuffer(
  input: DynamicBufferInput
): DynamicBufferOutput {
  const startMin = timeToMinutes(input.bookingStartTime);
  let endMin = timeToMinutes(input.bookingEndTime);
  if (endMin <= startMin) {
    endMin += 1440;
  }

  const configuredRule = Math.max(
    input.branchTravelBufferMinutes ?? 0,
    input.schedulingHomeBufferMinutes ?? 0,
    DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES
  );

  if (input.deliveryType === "in_spa") {
    const pre = Math.max(0, input.bufferBeforeMinutes ?? 0);
    const post = Math.max(0, input.bufferAfterMinutes ?? 0);
    return {
      preBufferMinutes: pre,
      postBufferMinutes: post,
      effectiveStartMinute: Math.max(0, startMin - pre),
      effectiveEndMinute: endMin + post,
      bufferSource: "branch_rule_fallback",
      configuredRuleBufferMinutes: configuredRule,
      note: "In-spa timing uses snapshot service preparation & completion buffers.",
    };
  }

  const safetyFloor = Math.max(
    MIN_SAFETY_HOME_BUFFER_MINUTES,
    input.bookingTravelBufferMinutes ?? configuredRule
  );
  const peak = input.isPeakHour ?? isPeakTrafficHour(startMin);
  const multiplier = peak ? 1.25 : 1.15;

  if (
    typeof input.liveEtaMinutes === "number" &&
    Number.isFinite(input.liveEtaMinutes) &&
    input.liveEtaMinutes >= 0
  ) {
    const padded = Math.ceil(input.liveEtaMinutes * multiplier);
    const pre = Math.max(safetyFloor, padded + 10);
    const post =
      input.collectionDecision === "not_required" ? 5 : Math.max(safetyFloor, padded + 5);
    return {
      preBufferMinutes: pre,
      postBufferMinutes: post,
      effectiveStartMinute: Math.max(0, startMin - pre),
      effectiveEndMinute: endMin + post,
      bufferSource: "live_traffic",
      configuredRuleBufferMinutes: configuredRule,
      note: `Live traffic ETA ${Math.round(input.liveEtaMinutes)}m × ${multiplier.toFixed(2)} margin -> ${pre}m pre / ${post}m post.`,
    };
  }

  if (
    typeof input.distanceKm === "number" &&
    Number.isFinite(input.distanceKm) &&
    input.distanceKm >= 0
  ) {
    const minPerKm = peak ? 3.2 : 2.6;
    const estDrive = Math.ceil(input.distanceKm * minPerKm) + 12;
    const pre = Math.max(safetyFloor, estDrive + 5);
    const post =
      input.collectionDecision === "not_required" ? 5 : Math.max(safetyFloor, estDrive);
    return {
      preBufferMinutes: pre,
      postBufferMinutes: post,
      effectiveStartMinute: Math.max(0, startMin - pre),
      effectiveEndMinute: endMin + post,
      bufferSource: "distance_fallback",
      configuredRuleBufferMinutes: configuredRule,
      note: `Distance ${input.distanceKm.toFixed(1)} km conservative fallback -> ${pre}m pre / ${post}m post.`,
    };
  }

  const fallbackPost =
    input.collectionDecision === "not_required"
      ? 10
      : Math.max(safetyFloor, DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES);
  const fallbackPre = Math.max(safetyFloor, DEFAULT_HOME_TRAVEL_FALLBACK_MINUTES);
  return {
    preBufferMinutes: fallbackPre,
    postBufferMinutes: fallbackPost,
    effectiveStartMinute: Math.max(0, startMin - fallbackPre),
    effectiveEndMinute: endMin + fallbackPost,
    bufferSource: "branch_rule_fallback",
    configuredRuleBufferMinutes: configuredRule,
    note: "Rule fallback travel buffer enforced (coordinates/ETA unavailable).",
  };
}
