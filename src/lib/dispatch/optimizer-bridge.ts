import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { z } from "zod";
import { logError, logInfo } from "@/lib/logger";
import { readDispatchJourneys, type DispatchJourney } from "@/lib/driver/dispatch";
import { processDriverNativePush } from "@/lib/driver/native-push";
import { createNotification } from "@/lib/notifications/create";
import { computeDynamicTransitionBuffer } from "@/lib/optimization/dynamic-buffer";
import { haversineDistanceMeters, isValidGeoPoint } from "./route-eta";

function deterministicJourneyUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest();
  // Format 16 bytes as deterministic RFC-4122 v4-compatible UUID
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const OPTIMIZER_DEFAULT_URL = "http://127.0.0.1:8100";
const OPTIMIZER_TIMEOUT_MS = 10_000;
const ROUTES_MATRIX_MAX_CHUNK = 20;

export type OptimizerLocationNode = {
  location_id: string;
  label: string;
  lat: number;
  lng: number;
  location_type: "branch" | "customer" | "driver_start" | "staging";
  branch_id: string;
};

export type OptimizerDriverInput = {
  driver_id: string;
  name: string;
  branch_id: string;
  allowed_branch_ids: string[];
  start_location_id: string;
  return_to_location_id: string;
  shift_start_minute: number;
  shift_end_minute: number;
  available_from_minute: number;
  available_until_minute: number;
  is_available: boolean;
  existing_committed_workload_minutes: number;
  vehicle_capacity: number;
  vehicle_type: string;
  vehicle_tags: string[];
  locked_stop_sequence: Array<{ obligation_id: string; stop_type: "pickup" | "dropoff" }>;
};

export type OptimizerTherapistInput = {
  therapist_id: string;
  name: string;
  booking_id: string;
  branch_id: string;
  pickup_location_id: string;
  customer_location_id: string;
  required_arrival_minute: number;
  estimated_service_end_minute: number;
  permitted_return_location_id: string;
  passenger_seats: number;
  shift_window?: { shift_start_minute: number; shift_end_minute: number };
  is_final_appointment: boolean;
  next_assignment?: {
    booking_id: string;
    assignment_type: "home_service" | "in_branch" | "off_shift_or_none";
    location_id: string;
    earliest_start_minute: number | null;
    required_arrival_minute: number;
    requires_company_transport: boolean | null;
    estimated_service_end_minute: number | null;
  };
  return_arrangement?: {
    disposition?: "required" | "not_required" | "undecided" | null;
    independent_departure_approved?: boolean | null;
    return_to_branch_required?: boolean | null;
    confirmed_collection_commitment?: boolean;
    approval_source?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    reason_code?: string | null;
  };
};

export type OptimizerObligationInput = {
  obligation_id: string;
  booking_id: string;
  therapist_id: string;
  branch_id: string;
  leg_type: "delivery" | "collection";
  pickup_location_id: string;
  dropoff_location_id: string;
  pickup_coordinates: { lat: number; lng: number };
  dropoff_coordinates: { lat: number; lng: number };
  pickup_window: { earliest_minute: number; latest_minute: number };
  dropoff_window: { earliest_minute: number; latest_minute: number };
  target_arrival_minute?: number;
  expected_ready_minute?: number;
  passenger_count: number;
  operational_state:
    | "unstarted"
    | "assigned"
    | "en_route_pickup"
    | "onboard"
    | "in_service"
    | "completed"
    | "cancelled";
  is_locked: boolean;
  locked_driver_id: string | null;
  previous_driver_id: string | null;
  linked_delivery_obligation_id: string | null;
  estimated_service_duration_minutes: number | null;
  require_collection_coverage: boolean;
};

export type OptimizerRequestPayload = {
  snapshot_id: string;
  planning_date: string;
  timezone: string;
  horizon_end_minute: number;
  drivers: OptimizerDriverInput[];
  therapists: OptimizerTherapistInput[];
  transport_obligations: OptimizerObligationInput[];
  travel_info: {
    locations: OptimizerLocationNode[];
    travel_time_minutes: number[][];
    travel_distance_km: number[][];
    matrix_version: string;
    generated_at: string;
  };
  config: {
    solver_time_limit_seconds: number;
    allow_partial_service: boolean;
    allow_delivery_when_collection_undecided: boolean;
    deterministic_seed: number;
  };
};

const optimizerResponseSchema = z.object({
  snapshot_id: z.string(),
  feasibility_status: z.enum(["feasible", "partial", "infeasible", "timeout"]),
  all_obligations_served: z.boolean(),
  collection_plan_safe: z.boolean(),
  operational_commitment_allowed: z.boolean(),
  routes: z.array(
    z.object({
      driver_id: z.string(),
      driver_name: z.string(),
      vehicle_capacity: z.number(),
      stops: z.array(
        z.object({
          sequence_index: z.number(),
          obligation_id: z.string().nullable().optional(),
          booking_id: z.string().nullable().optional(),
          therapist_id: z.string().nullable().optional(),
          leg_type: z.enum(["delivery", "collection"]).nullable().optional(),
          stop_type: z.enum(["driver_start", "pickup", "dropoff", "driver_return"]),
          location_id: z.string(),
          location_label: z.string(),
          arrival_minute: z.number(),
          departure_minute: z.number(),
          is_locked: z.boolean().optional(),
        })
      ),
      assigned_obligation_ids: z.array(z.string()),
      driving_minutes: z.number(),
      distance_km: z.number(),
      peak_occupancy: z.number(),
    })
  ),
  assignments: z.array(
    z.object({
      obligation_id: z.string(),
      booking_id: z.string(),
      therapist_id: z.string(),
      leg_type: z.enum(["delivery", "collection"]),
      driver_id: z.string(),
      pickup_minute: z.number(),
      dropoff_minute: z.number(),
      is_pooled_leg: z.boolean(),
      change_type: z.enum(["new", "unchanged", "reassigned", "rescheduled"]),
    })
  ),
  return_decisions: z.array(
    z.object({
      booking_id: z.string(),
      therapist_id: z.string(),
      requirement: z.enum(["required", "not_required", "undecided"]),
      reason_code: z.string(),
      decision_source: z.string(),
      destination_location_id: z.string().nullable().optional(),
      destination_type: z.enum(["branch", "next_customer", "none", "unresolved"]).optional(),
      independent_departure_approved: z.boolean().nullable().optional(),
      approval_source: z.string().nullable().optional(),
      approved_by: z.string().nullable().optional(),
      approved_at: z.string().nullable().optional(),
      detail: z.string().optional(),
    })
  ),
  collection_coverage: z.array(
    z.object({
      booking_id: z.string(),
      therapist_id: z.string(),
      delivery_driver_id: z.string().nullable().optional(),
      collection_driver_id: z.string().nullable().optional(),
      split_driver_coverage: z.boolean(),
      return_requirement: z.enum(["required", "not_required", "undecided"]),
      coverage_status: z.string(),
    })
  ),
  unassigned_obligations: z.array(
    z.object({
      obligation_id: z.string(),
      booking_id: z.string(),
      leg_type: z.enum(["delivery", "collection"]),
      reasons: z.array(z.string()),
      detail: z.string(),
    })
  ),
  infeasibility_reasons: z.array(z.string()),
  constraint_violations: z.array(z.string()),
  metrics: z.object({
    total_driving_minutes: z.number(),
    total_distance_km: z.number(),
    pooled_route_count: z.number(),
    pooled_leg_count: z.number(),
    active_driver_count: z.number(),
    served_obligation_count: z.number(),
    unassigned_obligation_count: z.number(),
  }),
  matrix_version: z.string(),
});

export type OptimizerResponsePayload = z.infer<typeof optimizerResponseSchema>;

export interface PlannedBookingUpdate {
  bookingId: string;
  vehicleJourneyId: string | null;
  deliveryDriverId: string | null;
  collectionDriverId: string | null;
  stopOrder: number;
  collectionDecision: "required" | "not_required" | "undecided";
  collectionApprovalMetadata: {
    reasonCode?: string | null;
    source?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
    collectionDriverId?: string | null;
  };
  returnDestination: { lat: number; lng: number; label: string } | null;
}

export interface OptimizerProposalSummary {
  available: true;
  snapshotId: string;
  planningDate: string;
  branchId: string;
  matrixVersion: string;
  response: OptimizerResponsePayload;
  bookingUpdates: PlannedBookingUpdate[];
  skippedMissingCoordinates: Array<{ bookingId: string; reason: string }>;
}

export interface OptimizerUnavailableSummary {
  available: false;
  reason: string;
  fallbackAllowed: true;
  skippedMissingCoordinates: Array<{ bookingId: string; reason: string }>;
}

export type OptimizerPlanResult = OptimizerProposalSummary | OptimizerUnavailableSummary;

export function getOptimizerBaseUrl(): string {
  const configured = process.env.CRADLEHUB_OPTIMIZER_URL?.trim();
  return configured && configured.length > 0
    ? configured.replace(/\/+$/, "")
    : OPTIMIZER_DEFAULT_URL;
}

function getGoogleServerMapsKey(): string | null {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const p = Number.parseFloat(val);
    return Number.isFinite(p) ? p : null;
  }
  return null;
}

function timeStringToMinutes(raw: string | null | undefined, endsNextDay = false): number {
  if (!raw) return 540;
  const parts = raw.split(":");
  const hh = Number.parseInt(parts[0] ?? "9", 10);
  const mm = Number.parseInt(parts[1] ?? "0", 10);
  const base = (Number.isFinite(hh) ? hh : 9) * 60 + (Number.isFinite(mm) ? mm : 0);
  return endsNextDay ? base + 1440 : base;
}

function resolveShiftWindow(
  daySchedules: Array<{
    start_time: string;
    end_time: string;
    ends_next_day: boolean;
    is_active: boolean;
  }>,
  override: {
    is_day_off: boolean;
    start_time: string | null;
    end_time: string | null;
    ends_next_day: boolean;
  } | null
): { available: boolean; startMinute: number; endMinute: number } {
  if (override) {
    if (override.is_day_off) {
      return { available: false, startMinute: 0, endMinute: 0 };
    }
    if (override.start_time && override.end_time) {
      const startMinute = timeStringToMinutes(override.start_time, false);
      const endMinute = Math.max(
        startMinute + 60,
        timeStringToMinutes(override.end_time, override.ends_next_day)
      );
      return { available: true, startMinute, endMinute };
    }
  }
  const active = daySchedules.filter((s) => s.is_active);
  if (active.length > 0) {
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = 0;
    for (const s of active) {
      const st = timeStringToMinutes(s.start_time, false);
      const en = timeStringToMinutes(s.end_time, s.ends_next_day);
      minStart = Math.min(minStart, st);
      maxEnd = Math.max(maxEnd, en);
    }
    if (Number.isFinite(minStart) && maxEnd > minStart) {
      return { available: true, startMinute: minStart, endMinute: maxEnd };
    }
  }
  return { available: true, startMinute: 480, endMinute: 1320 };
}

function haversineFallbackPair(
  from: OptimizerLocationNode,
  to: OptimizerLocationNode
): { minutes: number; km: number } {
  if (from.location_id === to.location_id) return { minutes: 0, km: 0 };
  const meters = haversineDistanceMeters(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng }
  );
  const roadKm = Math.round(((meters / 1000) * 1.35) * 100) / 100;
  const minutes = Math.max(3, Math.round((roadKm / 28) * 60));
  return { minutes, km: Math.max(0.5, roadKm) };
}

function parseProtoDurationSeconds(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/^(-?\d+(?:\.\d+)?)s$/);
  if (!match) return null;
  const sec = Number.parseFloat(match[1]!);
  return Number.isFinite(sec) ? Math.max(0, sec) : null;
}

/**
 * Computes an N x N road travel matrix using server-side Google Routes API v2 when configured,
 * falling back cleanly per-cell or wholly to road-adjusted Haversine when offline or unconfigured.
 */
export async function computeSnapshotTravelMatrix(
  locations: OptimizerLocationNode[],
  fetchImpl: typeof fetch = fetch
): Promise<{
  locations: OptimizerLocationNode[];
  travel_time_minutes: number[][];
  travel_distance_km: number[][];
  matrix_version: string;
  generated_at: string;
}> {
  const n = locations.length;
  const times: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const dists: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const est = haversineFallbackPair(locations[i]!, locations[j]!);
      times[i]![j] = est.minutes;
      dists[i]![j] = est.km;
    }
  }

  const key = getGoogleServerMapsKey();
  let routesCellsResolved = 0;
  const totalNonDiag = n * Math.max(0, n - 1);

  if (key && n > 1) {
    for (let oStart = 0; oStart < n; oStart += ROUTES_MATRIX_MAX_CHUNK) {
      const oSlice = locations.slice(oStart, oStart + ROUTES_MATRIX_MAX_CHUNK);
      for (let dStart = 0; dStart < n; dStart += ROUTES_MATRIX_MAX_CHUNK) {
        const dSlice = locations.slice(dStart, dStart + ROUTES_MATRIX_MAX_CHUNK);
        try {
          const response = await fetchImpl(
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask":
                  "originIndex,destinationIndex,duration,distanceMeters,condition",
              },
              body: JSON.stringify({
                origins: oSlice.map((loc) => ({
                  waypoint: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } },
                })),
                destinations: dSlice.map((loc) => ({
                  waypoint: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } },
                })),
                travelMode: "DRIVE",
                routingPreference: "TRAFFIC_AWARE",
              }),
              signal: AbortSignal.timeout(8000),
            }
          );

          if (!response.ok) continue;
          const payload = (await response.json()) as unknown;
          const entries = Array.isArray(payload) ? payload : [];

          for (const rawEntry of entries) {
            const entry = asRecord(rawEntry);
            if (!entry || entry.condition !== "ROUTE_EXISTS") continue;
            const oIdx = typeof entry.originIndex === "number" ? oStart + entry.originIndex : -1;
            const dIdx =
              typeof entry.destinationIndex === "number" ? dStart + entry.destinationIndex : -1;
            if (oIdx < 0 || oIdx >= n || dIdx < 0 || dIdx >= n || oIdx === dIdx) continue;

            const seconds = parseProtoDurationSeconds(entry.duration);
            const meters =
              typeof entry.distanceMeters === "number" && Number.isFinite(entry.distanceMeters)
                ? entry.distanceMeters
                : null;
            if (seconds !== null) {
              times[oIdx]![dIdx] = Math.max(1, Math.round(seconds / 60));
            }
            if (meters !== null) {
              dists[oIdx]![dIdx] = Math.max(0.1, Math.round((meters / 1000) * 100) / 100);
            }
            routesCellsResolved++;
          }
        } catch (err) {
          logError("optimizer.route_matrix_chunk_failed", { oStart, dStart, error: err });
        }
      }
    }
  }

  const matrix_version =
    totalNonDiag === 0 || !key || routesCellsResolved === 0
      ? "haversine-fallback-v1"
      : routesCellsResolved >= totalNonDiag
        ? "google-routes-v2"
        : "google-routes-partial-v2";

  return {
    locations,
    travel_time_minutes: times,
    travel_distance_km: dists,
    matrix_version,
    generated_at: new Date().toISOString(),
  };
}

export async function buildDispatchOptimizerSnapshot(args: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  planningDate: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  request: OptimizerRequestPayload;
  skippedMissingCoordinates: Array<{ bookingId: string; reason: string }>;
}> {
  const { supabase, branchId, planningDate, fetchImpl } = args;
  const weekday = new Date(`${planningDate}T00:00:00Z`).getUTCDay();

  const [branchRes, driversRes, homeBookingsRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, latitude, longitude")
      .eq("id", branchId)
      .single(),
    supabase
      .from("staff")
      .select("id, full_name, nickname, staff_type, is_active, metadata")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .eq("staff_type", "driver")
      .is("archived_at", null)
      .is("merged_into_staff_id", null),
    supabase
      .from("bookings")
      .select(
        "id, branch_id, staff_id, driver_id, booking_date, start_time, end_time, status, booking_progress_status, delivery_type, home_service_tracking_status, session_started_at, session_due_at, session_completed_at, metadata"
      )
      .eq("branch_id", branchId)
      .eq("booking_date", planningDate)
      .eq("delivery_type", "home_service")
      .not("status", "in", "(cancelled,no_show)")
      .neq("booking_progress_status", "no_show")
      .order("start_time", { ascending: true }),
  ]);

  if (branchRes.error || !branchRes.data) {
    throw new Error("Branch record is unavailable for optimization.");
  }
  const branch = branchRes.data;
  const branchLat = Number(branch.latitude);
  const branchLng = Number(branch.longitude);
  if (!isValidGeoPoint({ lat: branchLat, lng: branchLng })) {
    throw new Error("Branch GPS coordinates must be configured before optimizing routes.");
  }

  const rawHomeBookings = homeBookingsRes.data ?? [];
  const rawDrivers = driversRes.data ?? [];
  const therapistIds = Array.from(new Set(rawHomeBookings.map((b) => b.staff_id)));
  const allRelevantStaffIds = Array.from(
    new Set([...rawDrivers.map((d) => d.id), ...therapistIds])
  );

  const [therapistStaffRes, schedulesRes, overridesRes, snapshotsRes, therapistDayBookingsRes, assistanceRes] =
    await Promise.all([
      therapistIds.length > 0
        ? supabase.from("staff").select("id, full_name, nickname").in("id", therapistIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; full_name: string; nickname: string | null }>,
          }),
      allRelevantStaffIds.length > 0
        ? supabase
            .from("staff_schedules")
            .select("staff_id, start_time, end_time, ends_next_day, is_active")
            .in("staff_id", allRelevantStaffIds)
            .eq("day_of_week", weekday)
        : Promise.resolve({
            data: [] as Array<{
              staff_id: string;
              start_time: string;
              end_time: string;
              ends_next_day: boolean;
              is_active: boolean;
            }>,
          }),
      allRelevantStaffIds.length > 0
        ? supabase
            .from("schedule_overrides")
            .select("staff_id, is_day_off, start_time, end_time, ends_next_day")
            .in("staff_id", allRelevantStaffIds)
            .eq("override_date", planningDate)
        : Promise.resolve({
            data: [] as Array<{
              staff_id: string;
              is_day_off: boolean;
              start_time: string | null;
              end_time: string | null;
              ends_next_day: boolean;
            }>,
          }),
      rawDrivers.length > 0
        ? supabase
            .from("staff_location_snapshots")
            .select("staff_id, lat, lng, accuracy_meters, recorded_at")
            .eq("branch_id", branchId)
            .in(
              "staff_id",
              rawDrivers.map((d) => d.id)
            )
            .order("recorded_at", { ascending: false })
            .limit(200)
        : Promise.resolve({
            data: [] as Array<{
              staff_id: string;
              lat: number;
              lng: number;
              accuracy_meters: number | null;
              recorded_at: string;
            }>,
          }),
      (async (): Promise<{
        data: Array<{
          id: string;
          staff_id: string | null;
          branch_id: string;
          delivery_type: string;
          start_time: string;
          end_time: string;
          status: string;
          booking_progress_status: string;
          session_started_at?: string | null;
          session_due_at?: string | null;
          metadata: Json;
        }> | null;
      }> => {
        try {
          if (therapistIds.length > 0) {
            const tbl = supabase.from("bookings") as unknown as {
              select?: (c: string) => Record<string, unknown>;
            };
            const s = tbl?.select?.(
              "id, staff_id, branch_id, delivery_type, start_time, end_time, status, booking_progress_status, session_started_at, session_due_at, metadata"
            ) as {
              eq?: (k: string, v: unknown) => Record<string, unknown>;
            } | undefined;
            const b1 = s?.eq?.("booking_date", planningDate) as {
              in?: (k: string, v: unknown[]) => Record<string, unknown>;
            } | undefined;
            const b2 = b1?.in?.("staff_id", therapistIds) as {
              not?: (k: string, op: string, v: unknown) => Record<string, unknown>;
            } | undefined;
            const b3 = b2?.not?.("status", "in", "(cancelled,no_show)") as {
              neq?: (k: string, v: unknown) => Record<string, unknown>;
            } | undefined;
            const b4 = b3?.neq?.("booking_progress_status", "no_show") as {
              order?: (k: string, o: unknown) => Promise<{
                data?: Array<{
                  id: string;
                  staff_id: string | null;
                  branch_id: string;
                  delivery_type: string;
                  start_time: string;
                  end_time: string;
                  status: string;
                  booking_progress_status: string;
                  session_started_at?: string | null;
                  session_due_at?: string | null;
                  metadata: Json;
                }> | null;
              }>;
            } | undefined;
            if (typeof b4?.order === "function") {
              const res = await b4.order("start_time", { ascending: true });
              return { data: res.data ?? [] };
            }
          }
        } catch {
          /* fallback below for minimal unit mocks */
        }
        if (therapistIds.length === 0) return { data: [] };
        const fallback = await supabase
          .from("bookings")
          .select(
            "id, staff_id, branch_id, delivery_type, start_time, end_time, status, booking_progress_status, metadata"
          )
          .eq("booking_date", planningDate)
          .in("staff_id", therapistIds)
          .not("status", "in", "(cancelled,no_show)")
          .neq("booking_progress_status", "no_show")
          .order("start_time", { ascending: true });
        return {
          data: (fallback.data ?? []).map((row) => ({
            ...row,
            session_started_at: null,
            session_due_at: null,
          })),
        };
      })(),
      // Stage B staff_assistance_requests (`approved_pending_arrival`) are provisional only and must NOT grant cross-branch booking/dispatch capacity.
      Promise.resolve({
        data: [] as Array<{
          requesting_branch_id: string;
          lending_branch_id: string | null;
          status: string;
          selected_staff_ids: string[] | null;
        }>,
      }),
    ]);

  const activeJourneys = new Map<string, DispatchJourney>();
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED === "true") {
    try {
      const list = await readDispatchJourneys(supabase, branchId);
      for (const entry of list) activeJourneys.set(entry.journey.bookingId, entry);
    } catch {
      /* Journey projection falls back cleanly to booking metadata */
    }
  }

  const locationsMap = new Map<string, OptimizerLocationNode>();
  const branchLocationId = `branch:${branch.id}`;
  locationsMap.set(branchLocationId, {
    location_id: branchLocationId,
    label: branch.name,
    lat: branchLat,
    lng: branchLng,
    location_type: "branch",
    branch_id: branch.id,
  });

  const schedulesByStaff = new Map<
    string,
    Array<{ start_time: string; end_time: string; ends_next_day: boolean; is_active: boolean }>
  >();
  for (const row of schedulesRes.data ?? []) {
    const arr = schedulesByStaff.get(row.staff_id) ?? [];
    arr.push(row);
    schedulesByStaff.set(row.staff_id, arr);
  }
  const overridesByStaff = new Map<
    string,
    {
      is_day_off: boolean;
      start_time: string | null;
      end_time: string | null;
      ends_next_day: boolean;
    }
  >();
  for (const ov of overridesRes.data ?? []) {
    overridesByStaff.set(ov.staff_id, ov);
  }

  const latestGpsByDriver = new Map<string, { lat: number; lng: number }>();
  const freshThresholdMs = Date.now() - 15 * 60_000;
  for (const snap of snapshotsRes.data ?? []) {
    if (latestGpsByDriver.has(snap.staff_id)) continue;
    const accOk =
      snap.accuracy_meters === null ||
      snap.accuracy_meters === undefined ||
      snap.accuracy_meters <= 100;
    if (
      accOk &&
      Date.parse(snap.recorded_at) >= freshThresholdMs &&
      isValidGeoPoint({ lat: snap.lat, lng: snap.lng })
    ) {
      latestGpsByDriver.set(snap.staff_id, { lat: snap.lat, lng: snap.lng });
    }
  }

  const allowedBranchesByStaff = new Map<string, string[]>();
  const assistList = Array.isArray(assistanceRes.data) ? assistanceRes.data : [];
  for (const ar of assistList) {
    if (typeof ar.requesting_branch_id !== "string") continue;
    const selected = Array.isArray(ar.selected_staff_ids) ? ar.selected_staff_ids : [];
    for (const sid of selected) {
      if (typeof sid !== "string") continue;
      const cur = allowedBranchesByStaff.get(sid) ?? [branchId];
      if (!cur.includes(ar.requesting_branch_id)) cur.push(ar.requesting_branch_id);
      allowedBranchesByStaff.set(sid, cur);
    }
  }

  const therapistNames = new Map<string, string>();
  for (const t of therapistStaffRes.data ?? []) {
    therapistNames.set(t.id, t.nickname?.trim() || t.full_name);
  }

  const bookingsByTherapist = new Map<string, NonNullable<typeof therapistDayBookingsRes.data>>();
  for (const b of therapistDayBookingsRes.data ?? []) {
    if (b.staff_id) {
      const list = bookingsByTherapist.get(b.staff_id) ?? [];
      list.push(b);
      bookingsByTherapist.set(b.staff_id, list);
    }
    const bMeta = asRecord(b.metadata);
    const addr = asRecord(bMeta?.home_service_address);
    const lat = parseNumber(addr?.lat);
    const lng = parseNumber(addr?.lng);
    if (
      b.delivery_type === "home_service" &&
      lat !== null &&
      lng !== null &&
      isValidGeoPoint({ lat, lng })
    ) {
      const custLocId = `customer:${b.id}`;
      locationsMap.set(custLocId, {
        location_id: custLocId,
        label:
          (typeof addr?.full_address === "string" && addr.full_address) ||
          (typeof addr?.barangay === "string" && addr.barangay) ||
          `Booking ${b.id.slice(0, 8)}`,
        lat,
        lng,
        location_type: "customer",
        branch_id: branchId,
      });
    }
  }

  const drivers: OptimizerDriverInput[] = rawDrivers.map((d) => {
    const win = resolveShiftWindow(
      schedulesByStaff.get(d.id) ?? [],
      overridesByStaff.get(d.id) ?? null
    );
    const gps = latestGpsByDriver.get(d.id);
    const startLocId = gps ? `driver_start:${d.id}` : branchLocationId;
    if (gps) {
      locationsMap.set(startLocId, {
        location_id: startLocId,
        label: `${d.nickname?.trim() || d.full_name} current GPS`,
        lat: gps.lat,
        lng: gps.lng,
        location_type: "driver_start",
        branch_id: branchId,
      });
    }
    const dMeta = asRecord(d.metadata);
    const rawCap = parseNumber(dMeta?.vehicle_capacity);
    const vehicleCapacity = rawCap !== null && rawCap >= 1 ? Math.round(rawCap) : 4;

    return {
      driver_id: d.id,
      name: d.nickname?.trim() || d.full_name,
      branch_id: branchId,
      allowed_branch_ids: allowedBranchesByStaff.get(d.id) ?? [branchId],
      start_location_id: startLocId,
      return_to_location_id: branchLocationId,
      shift_start_minute: win.startMinute,
      shift_end_minute: win.endMinute,
      available_from_minute: win.startMinute,
      available_until_minute: win.endMinute,
      is_available: win.available,
      existing_committed_workload_minutes: 0,
      vehicle_capacity: vehicleCapacity,
      vehicle_type: typeof dMeta?.vehicle_type === "string" ? dMeta.vehicle_type : "mpv",
      vehicle_tags: [],
      locked_stop_sequence: [],
    };
  });

  const driverById = new Map(drivers.map((d) => [d.driver_id, d]));
  const therapists: OptimizerTherapistInput[] = [];
  const transport_obligations: OptimizerObligationInput[] = [];
  const skippedMissingCoordinates: Array<{ bookingId: string; reason: string }> = [];

  for (const b of rawHomeBookings) {
    const meta = asRecord(b.metadata);
    const addr = asRecord(meta?.home_service_address);
    const cLat = parseNumber(addr?.lat);
    const cLng = parseNumber(addr?.lng);
    if (cLat === null || cLng === null || !isValidGeoPoint({ lat: cLat, lng: cLng })) {
      skippedMissingCoordinates.push({
        bookingId: b.id,
        reason: "Customer GPS coordinates are missing.",
      });
      continue;
    }

    const custLocId = `customer:${b.id}`;
    const journeyEntry = activeJourneys.get(b.id);
    const stage = journeyEntry?.journey.stage ?? null;
    const reqArrMin = timeStringToMinutes(b.start_time);
    const estEndMin = Math.max(reqArrMin + 30, timeStringToMinutes(b.end_time));
    const serviceDurMin = Math.max(30, estEndMin - reqArrMin);

    const thWin = resolveShiftWindow(
      schedulesByStaff.get(b.staff_id) ?? [],
      overridesByStaff.get(b.staff_id) ?? null
    );

    const allDayForTherapist = bookingsByTherapist.get(b.staff_id) ?? [];
    const currentIndex = allDayForTherapist.findIndex((row) => row.id === b.id);
    const nextRow =
      currentIndex >= 0 && currentIndex + 1 < allDayForTherapist.length
        ? allDayForTherapist[currentIndex + 1]!
        : null;
    const isFinal = nextRow === null;

    let nextAssignment: OptimizerTherapistInput["next_assignment"] | undefined;
    if (nextRow) {
      const nextCustLocId = `customer:${nextRow.id}`;
      const hasNextCustCoords =
        nextRow.delivery_type === "home_service" && locationsMap.has(nextCustLocId);
      const nextLocId =
        nextRow.delivery_type === "home_service" && hasNextCustCoords
          ? nextCustLocId
          : branchLocationId;
      const nextStartMin = timeStringToMinutes(nextRow.start_time);
      nextAssignment = {
        booking_id: nextRow.id,
        assignment_type: nextRow.delivery_type === "home_service" ? "home_service" : "in_branch",
        location_id: nextLocId,
        earliest_start_minute: nextStartMin,
        required_arrival_minute: nextStartMin,
        requires_company_transport: true,
        estimated_service_end_minute: timeStringToMinutes(nextRow.end_time),
      };
    }

    const rawDc = asRecord(meta?.driver_collection);
    const dcDisposition =
      rawDc?.decision === "required" ||
      rawDc?.decision === "not_required" ||
      rawDc?.decision === "undecided"
        ? rawDc.decision
        : null;

    const approvedBy = typeof rawDc?.approvedBy === "string" ? rawDc.approvedBy : null;
    const approvedAt = typeof rawDc?.approvedAt === "string" ? rawDc.approvedAt : null;
    const approvalSource = typeof rawDc?.source === "string" ? rawDc.source : null;
    const independentApproved =
      dcDisposition === "not_required" && Boolean(approvedBy || approvedAt || approvalSource);

    const returnArrangement: OptimizerTherapistInput["return_arrangement"] | undefined = dcDisposition
      ? {
          disposition: dcDisposition,
          independent_departure_approved: independentApproved ? true : null,
          return_to_branch_required: dcDisposition === "required" ? true : null,
          confirmed_collection_commitment: dcDisposition === "required",
          approval_source: approvalSource,
          approved_by: approvedBy,
          approved_at: approvedAt,
          reason_code: typeof rawDc?.reasonCode === "string" ? rawDc.reasonCode : null,
        }
      : undefined;

    therapists.push({
      therapist_id: b.staff_id,
      name: therapistNames.get(b.staff_id) ?? "Therapist",
      booking_id: b.id,
      branch_id: branchId,
      pickup_location_id: branchLocationId,
      customer_location_id: custLocId,
      required_arrival_minute: reqArrMin,
      estimated_service_end_minute: estEndMin,
      permitted_return_location_id:
        nextAssignment?.assignment_type === "home_service"
          ? nextAssignment.location_id
          : branchLocationId,
      passenger_seats: 1,
      shift_window: thWin.available
        ? { shift_start_minute: thWin.startMinute, shift_end_minute: thWin.endMinute }
        : undefined,
      is_final_appointment: isFinal,
      next_assignment: nextAssignment,
      return_arrangement: returnArrangement,
    });

    const delivDriverId = journeyEntry?.journey.deliveryDriverId ?? b.driver_id;
    const delivLockedStages = new Set([
      "pickup_enroute",
      "pickup_arrived",
      "delivery_pending",
      "delivery_enroute",
      "customer_arrived",
      "service_active",
      "collection_pending",
      "collection_enroute",
      "collection_arrived",
      "return_pending",
      "return_enroute",
      "return_arrived",
      "complete",
    ]);
    const isDelivLocked =
      Boolean(delivDriverId) &&
      ((stage !== null && delivLockedStages.has(stage)) ||
        ["in_route", "arrived_at_customer", "service_started", "completed"].includes(
          b.home_service_tracking_status
        ));

    const delivState: OptimizerObligationInput["operational_state"] =
      stage === "pickup_enroute"
        ? "en_route_pickup"
        : stage === "pickup_arrived" || stage === "delivery_pending" || stage === "delivery_enroute"
          ? "onboard"
          : stage === "customer_arrived" || stage === "service_active"
            ? "in_service"
            : stage?.startsWith("collection_") || stage?.startsWith("return_") || stage === "complete"
              ? "completed"
              : delivDriverId
                ? "assigned"
                : "unstarted";

    const delivObligationId = `del:${b.id}`;
    if (isDelivLocked && delivDriverId && driverById.has(delivDriverId)) {
      driverById.get(delivDriverId)!.locked_stop_sequence.push(
        { obligation_id: delivObligationId, stop_type: "pickup" },
        { obligation_id: delivObligationId, stop_type: "dropoff" }
      );
    }

    if (delivState !== "completed") {
      const distKm =
        haversineDistanceMeters({ lat: branchLat, lng: branchLng }, { lat: cLat, lng: cLng }) / 1000;
      const dynBuf = computeDynamicTransitionBuffer({
        deliveryType: "home_service",
        bookingStartTime: b.start_time,
        bookingEndTime: b.end_time,
        distanceKm: distKm,
        collectionDecision: dcDisposition,
      });
      const earliestPickup = Math.max(
        thWin.available ? thWin.startMinute : 0,
        reqArrMin - Math.max(dynBuf.preBufferMinutes + 45, 90)
      );
      transport_obligations.push({
        obligation_id: delivObligationId,
        booking_id: b.id,
        therapist_id: b.staff_id,
        branch_id: branchId,
        leg_type: "delivery",
        pickup_location_id: branchLocationId,
        dropoff_location_id: custLocId,
        pickup_coordinates: { lat: branchLat, lng: branchLng },
        dropoff_coordinates: { lat: cLat, lng: cLng },
        pickup_window: {
          earliest_minute: earliestPickup,
          latest_minute: Math.max(0, reqArrMin - Math.min(15, dynBuf.preBufferMinutes)),
        },
        dropoff_window: {
          earliest_minute: Math.max(0, reqArrMin - Math.max(dynBuf.preBufferMinutes, 35)),
          latest_minute: reqArrMin,
        },
        target_arrival_minute: reqArrMin,
        passenger_count: 1,
        operational_state: delivState,
        is_locked: Boolean(isDelivLocked && delivDriverId),
        locked_driver_id: isDelivLocked ? delivDriverId : null,
        previous_driver_id: delivDriverId,
        linked_delivery_obligation_id: null,
        estimated_service_duration_minutes: serviceDurMin,
        require_collection_coverage: dcDisposition !== "not_required",
      });
    }

    if (dcDisposition !== "not_required" && stage !== "complete") {
      const colDriverId =
        journeyEntry?.journey.collectionDriverId ??
        (typeof rawDc?.collectionDriverId === "string" ? rawDc.collectionDriverId : null) ??
        b.driver_id;
      const colLockedStages = new Set([
        "collection_enroute",
        "collection_arrived",
        "return_pending",
        "return_enroute",
        "return_arrived",
      ]);
      const isColLocked = Boolean(colDriverId && stage && colLockedStages.has(stage));
      const colState: OptimizerObligationInput["operational_state"] =
        stage === "collection_enroute"
          ? "en_route_pickup"
          : stage === "collection_arrived" ||
              stage === "return_pending" ||
              stage === "return_enroute" ||
              stage === "return_arrived"
            ? "onboard"
            : colDriverId
              ? "assigned"
              : "unstarted";
      const colObligationId = `col:${b.id}`;
      const returnLocNode =
        nextAssignment?.assignment_type === "home_service"
          ? locationsMap.get(nextAssignment.location_id)!
          : locationsMap.get(branchLocationId)!;

      if (isColLocked && colDriverId && driverById.has(colDriverId)) {
        driverById.get(colDriverId)!.locked_stop_sequence.push(
          { obligation_id: colObligationId, stop_type: "pickup" },
          { obligation_id: colObligationId, stop_type: "dropoff" }
        );
      }

      transport_obligations.push({
        obligation_id: colObligationId,
        booking_id: b.id,
        therapist_id: b.staff_id,
        branch_id: branchId,
        leg_type: "collection",
        pickup_location_id: custLocId,
        dropoff_location_id: returnLocNode.location_id,
        pickup_coordinates: { lat: cLat, lng: cLng },
        dropoff_coordinates: { lat: returnLocNode.lat, lng: returnLocNode.lng },
        pickup_window: {
          earliest_minute: estEndMin,
          latest_minute: estEndMin + 60,
        },
        dropoff_window: {
          earliest_minute: estEndMin + 10,
          latest_minute: estEndMin + 120,
        },
        expected_ready_minute: estEndMin,
        passenger_count: 1,
        operational_state: colState,
        is_locked: isColLocked,
        locked_driver_id: isColLocked ? colDriverId : null,
        previous_driver_id: colDriverId,
        linked_delivery_obligation_id: delivState === "completed" ? null : delivObligationId,
        estimated_service_duration_minutes: serviceDurMin,
        require_collection_coverage: true,
      });
    }
  }

  const locations = Array.from(locationsMap.values());
  const travel_info = await computeSnapshotTravelMatrix(locations, fetchImpl);

  return {
    request: {
      snapshot_id: `o4-${branchId.slice(0, 8)}-${planningDate}-${Date.now()}`,
      planning_date: planningDate,
      timezone: "Asia/Manila",
      horizon_end_minute: 1440,
      drivers,
      therapists,
      transport_obligations,
      travel_info,
      config: {
        solver_time_limit_seconds: 5,
        allow_partial_service: true,
        allow_delivery_when_collection_undecided: true,
        deterministic_seed: 42,
      },
    },
    skippedMissingCoordinates,
  };
}

export function buildBookingUpdatesFromOptimizerResponse(
  request: OptimizerRequestPayload,
  response: OptimizerResponsePayload
): PlannedBookingUpdate[] {
  const locationById = new Map(
    request.travel_info.locations.map((loc) => [loc.location_id, loc])
  );
  const returnDecisionByBooking = new Map(
    response.return_decisions.map((d) => [d.booking_id, d])
  );

  // Assign one deterministic vehicleJourneyId per non-empty route
  const deliveryRouteInfoByBooking = new Map<
    string,
    { vehicleJourneyId: string; driverId: string; stopOrder: number }
  >();
  const collectionDriverByBooking = new Map<string, string>();

  // Segment multi-tour routes per driver whenever the vehicle empties back at branch between deliveries
  for (const route of response.routes) {
    if (route.stops.length <= 2) continue;
    let tourIndex = 0;
    let onboardCount = 0;
    let stopOrderInTour = 0;
    let currentTourHasDelivery = false;
    let currentVjId = deterministicJourneyUuid(
      `${request.planning_date}:${route.driver_id}:tour:${tourIndex}`
    );

    for (const stop of route.stops) {
      if (
        (stop.stop_type === "pickup" && stop.leg_type === "delivery") ||
        (stop.stop_type === "pickup" && stop.leg_type === "collection")
      ) {
        if (onboardCount === 0 && currentTourHasDelivery && stop.leg_type === "delivery") {
          tourIndex += 1;
          stopOrderInTour = 0;
          currentTourHasDelivery = false;
          currentVjId = deterministicJourneyUuid(
            `${request.planning_date}:${route.driver_id}:tour:${tourIndex}`
          );
        }
        onboardCount += 1;
      } else if (stop.stop_type === "dropoff" || stop.stop_type === "driver_return") {
        onboardCount = Math.max(0, onboardCount - 1);
      }

      if (!stop.booking_id) continue;
      if (stop.leg_type === "delivery" && stop.stop_type === "dropoff") {
        currentTourHasDelivery = true;
        stopOrderInTour += 1;
        deliveryRouteInfoByBooking.set(stop.booking_id, {
          vehicleJourneyId: currentVjId,
          driverId: route.driver_id,
          stopOrder: stopOrderInTour,
        });
      } else if (stop.leg_type === "collection" && stop.stop_type === "pickup") {
        collectionDriverByBooking.set(stop.booking_id, route.driver_id);
      }
    }
  }

  for (const assign of response.assignments) {
    if (assign.leg_type === "delivery" && !deliveryRouteInfoByBooking.has(assign.booking_id)) {
      deliveryRouteInfoByBooking.set(assign.booking_id, {
        vehicleJourneyId: deterministicJourneyUuid(
          `${request.planning_date}:${assign.driver_id}:fallback:${assign.booking_id}`
        ),
        driverId: assign.driver_id,
        stopOrder: 1,
      });
    } else if (
      assign.leg_type === "collection" &&
      !collectionDriverByBooking.has(assign.booking_id)
    ) {
      collectionDriverByBooking.set(assign.booking_id, assign.driver_id);
    }
  }

  const bookingIds = Array.from(
    new Set([
      ...request.therapists.map((t) => t.booking_id),
      ...deliveryRouteInfoByBooking.keys(),
      ...collectionDriverByBooking.keys(),
    ])
  );

  const updates: PlannedBookingUpdate[] = [];
  for (const bookingId of bookingIds) {
    const delInfo = deliveryRouteInfoByBooking.get(bookingId) ?? null;
    const dec = returnDecisionByBooking.get(bookingId) ?? null;
    const collectionDecision = dec?.requirement ?? "required";
    const collectionDriverId =
      collectionDecision === "not_required"
        ? null
        : (collectionDriverByBooking.get(bookingId) ?? delInfo?.driverId ?? null);

    const destNode =
      dec?.destination_location_id ? locationById.get(dec.destination_location_id) ?? null : null;

    updates.push({
      bookingId,
      vehicleJourneyId: delInfo?.vehicleJourneyId ?? null,
      deliveryDriverId: delInfo?.driverId ?? null,
      collectionDriverId,
      stopOrder: delInfo?.stopOrder ?? 1,
      collectionDecision,
      collectionApprovalMetadata: {
        reasonCode: dec?.reason_code ?? null,
        source: dec?.approval_source ?? dec?.decision_source ?? null,
        approvedBy: dec?.approved_by ?? null,
        approvedAt: dec?.approved_at ?? null,
        collectionDriverId,
      },
      returnDestination: destNode
        ? { lat: destNode.lat, lng: destNode.lng, label: destNode.label }
        : null,
    });
  }

  return updates.filter((u) => u.deliveryDriverId !== null || u.collectionDriverId !== null);
}

/**
 * Calls the local/configured O1 Python OR-Tools service, never blocking CRM if unavailable.
 */
export async function requestDispatchOptimizationPlan(args: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  planningDate: string;
  fetchImpl?: typeof fetch;
}): Promise<OptimizerPlanResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const { request, skippedMissingCoordinates } = await buildDispatchOptimizerSnapshot({
    supabase: args.supabase,
    branchId: args.branchId,
    planningDate: args.planningDate,
    fetchImpl,
  });

  if (request.transport_obligations.length === 0) {
    return {
      available: false,
      reason: "No home-service visits with verified GPS coordinates need routing today.",
      fallbackAllowed: true,
      skippedMissingCoordinates,
    };
  }

  if (request.drivers.filter((d) => d.is_available).length === 0) {
    return {
      available: false,
      reason: "No available active drivers found for this branch and date.",
      fallbackAllowed: true,
      skippedMissingCoordinates,
    };
  }

  const baseUrl = getOptimizerBaseUrl();
  try {
    const res = await fetchImpl(`${baseUrl}/v1/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(OPTIMIZER_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        available: false,
        reason: `Optimizer service responded with HTTP ${res.status}. Manual dispatch remains active. ${detail.slice(0, 120)}`.trim(),
        fallbackAllowed: true,
        skippedMissingCoordinates,
      };
    }

    const parsed = optimizerResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      return {
        available: false,
        reason: "Optimizer reply could not be verified. Manual dispatch remains active.",
        fallbackAllowed: true,
        skippedMissingCoordinates,
      };
    }

    const bookingUpdates = buildBookingUpdatesFromOptimizerResponse(request, parsed.data);
    return {
      available: true,
      snapshotId: parsed.data.snapshot_id,
      planningDate: args.planningDate,
      branchId: args.branchId,
      matrixVersion: request.travel_info.matrix_version,
      response: parsed.data,
      bookingUpdates,
      skippedMissingCoordinates,
    };
  } catch (err) {
    logInfo("optimizer.unavailable_fallback", {
      branchId: args.branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      available: false,
      reason:
        "Optimizer service is offline or timed out. Manual dispatch remains fully operational.",
      fallbackAllowed: true,
      skippedMissingCoordinates,
    };
  }
}

/**
 * Re-validates a proposed O1 plan against current authoritative DB bookings & drivers
 * immediately before atomic commitment so stale snapshots never overwrite live work.
 */
export async function validateProposedPlanAgainstDb(args: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  bookingUpdates: PlannedBookingUpdate[];
}): Promise<{ valid: true } | { valid: false; errors: string[] }> {
  const { supabase, branchId, bookingUpdates } = args;
  const errors: string[] = [];

  if (bookingUpdates.length === 0) {
    return { valid: false, errors: ["No assignable driver legs exist in this optimization plan."] };
  }

  const bookingIds = bookingUpdates.map((u) => u.bookingId);
  const driverIds = Array.from(
    new Set(
      bookingUpdates
        .flatMap((u) => [u.deliveryDriverId, u.collectionDriverId])
        .filter((id): id is string => Boolean(id))
    )
  );

  const [bookingsRes, driversRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, branch_id, status, booking_progress_status, driver_id, delivery_type, home_service_tracking_status")
      .eq("branch_id", branchId)
      .in("id", bookingIds),
    driverIds.length > 0
      ? supabase
          .from("staff")
          .select("id, branch_id, is_active, archived_at, merged_into_staff_id, system_role, staff_type, metadata")
          .eq("branch_id", branchId)
          .in("id", driverIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            branch_id: string;
            is_active: boolean;
            archived_at: string | null;
            merged_into_staff_id: string | null;
            system_role: string;
            staff_type: string;
            metadata: Json;
          }>,
        }),
  ]);

  const bookingsById = new Map((bookingsRes.data ?? []).map((b) => [b.id, b]));
  const driversById = new Map((driversRes.data ?? []).map((d) => [d.id, d]));

  const vehicleLoads = new Map<string, number>();

  for (const update of bookingUpdates) {
    const row = bookingsById.get(update.bookingId);
    if (!row || row.delivery_type !== "home_service") {
      errors.push(`Booking ${update.bookingId} is no longer an active branch home-service booking.`);
      continue;
    }
    if (row.status === "cancelled" || row.status === "no_show" || row.booking_progress_status === "no_show") {
      errors.push(`Booking ${update.bookingId} became ${row.status}; re-run optimization.`);
      continue;
    }

    if (
      update.collectionDecision === "not_required" &&
      !update.collectionApprovalMetadata.approvedBy &&
      !update.collectionApprovalMetadata.approvedAt &&
      !update.collectionApprovalMetadata.source
    ) {
      errors.push(`Booking ${update.bookingId} cannot omit collection without approval metadata.`);
    }

    for (const dId of [update.deliveryDriverId, update.collectionDriverId]) {
      if (!dId) continue;
      const drv = driversById.get(dId);
      const isDriverRole = drv?.staff_type === "driver" || drv?.system_role === "driver";
      if (!drv || !drv.is_active || Boolean(drv.archived_at) || Boolean(drv.merged_into_staff_id) || !isDriverRole) {
        errors.push(`Assigned driver ${dId} is inactive, archived/merged, or not an authorized driver for this branch.`);
      }
    }

    if (update.vehicleJourneyId && update.deliveryDriverId) {
      const key = `${update.vehicleJourneyId}:${update.deliveryDriverId}`;
      vehicleLoads.set(key, (vehicleLoads.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of vehicleLoads) {
    const driverId = key.split(":")[1]!;
    const drv = driversById.get(driverId);
    const meta = asRecord(drv?.metadata);
    const cap = parseNumber(meta?.vehicle_capacity) ?? 4;
    if (count > cap) {
      errors.push(`Pooled vehicle load (${count}) exceeds driver capacity (${cap}).`);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

export async function commitOptimizedDispatchPlan(args: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  actorStaffId: string;
  snapshotId: string;
  bookingUpdates: PlannedBookingUpdate[];
}): Promise<
  | { ok: true; committedCount: number; notifiedDriverIds: string[] }
  | { ok: false; error: string }
> {
  const { supabase, branchId, actorStaffId, snapshotId, bookingUpdates } = args;

  const check = await validateProposedPlanAgainstDb({
    supabase,
    branchId,
    bookingUpdates,
  });
  if (!check.valid) {
    return { ok: false, error: check.errors[0] ?? "Plan validation failed." };
  }

  let notifiedDriverIds: string[] = [];
  let committedCount = 0;

  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED === "true") {
    const { data, error } = await supabase.rpc(
      "driver_o4_commit_plan" as never,
      {
        p_branch_id: branchId,
        p_plan: { snapshotId, bookingUpdates },
      } as never
    );

    if (error || !asRecord(data)?.ok) {
      return {
        ok: false,
        error:
          error?.message || "Plan commit was rejected because active bookings or journeys changed.",
      };
    }

    const resObj = asRecord(data)!;
    committedCount = typeof resObj.committedCount === "number" ? resObj.committedCount : bookingUpdates.length;
    if (Array.isArray(resObj.notifiedDriverIds)) {
      notifiedDriverIds = resObj.notifiedDriverIds.filter((id): id is string => typeof id === "string");
    }
  } else {
    // Fallback mode when unified SQL flag is inactive: validate ALL rows before writing, verify row updates, and roll back prior writes on failure
    const preparedUpdates: Array<{
      update: PlannedBookingUpdate;
      targetDriver: string;
      priorRow: {
        id: string;
        driver_id: string | null;
        home_service_tracking_status: string;
        metadata: Json;
      };
      nextMeta: Record<string, Json | undefined>;
    }> = [];

    for (const u of bookingUpdates) {
      const targetDriver = u.deliveryDriverId ?? u.collectionDriverId;
      if (!targetDriver) continue;

      const { data: current } = await supabase
        .from("bookings")
        .select("id, driver_id, metadata, home_service_tracking_status, booking_progress_status")
        .eq("id", u.bookingId)
        .eq("branch_id", branchId)
        .single();
      if (!current) {
        return { ok: false, error: `Booking ${u.bookingId} could not be loaded for fallback commit.` };
      }

      const isActiveLifecycle =
        ["in_route", "arrived_at_customer", "service_started", "completed"].includes(
          current.home_service_tracking_status
        ) || current.booking_progress_status !== "not_started";
      if (isActiveLifecycle && current.driver_id !== targetDriver) {
        return {
          ok: false,
          error: "Cannot reassign an active home-service booking once travel or service has begun.",
        };
      }

      const baseMeta = asRecord(current.metadata) ?? {};
      const nextMeta: Record<string, Json | undefined> = {
        ...baseMeta,
        driver_collection: {
          decision: u.collectionDecision,
          reasonCode: u.collectionApprovalMetadata.reasonCode ?? null,
          source: u.collectionApprovalMetadata.source ?? null,
          approvedBy: u.collectionApprovalMetadata.approvedBy ?? null,
          approvedAt: u.collectionApprovalMetadata.approvedAt ?? null,
          collectionDriverId: u.collectionDriverId,
        },
        o4_plan: {
          snapshotId,
          vehicleJourneyId: u.vehicleJourneyId,
          stopOrder: u.stopOrder,
          deliveryDriverId: u.deliveryDriverId,
          collectionDriverId: u.collectionDriverId,
          committedBy: actorStaffId,
          committedAt: new Date().toISOString(),
        },
      };

      preparedUpdates.push({
        update: u,
        targetDriver,
        priorRow: {
          id: current.id,
          driver_id: current.driver_id,
          home_service_tracking_status: current.home_service_tracking_status,
          metadata: current.metadata,
        },
        nextMeta,
      });
    }

    const appliedSnapshots: Array<(typeof preparedUpdates)[number]["priorRow"]> = [];
    const driverSet = new Set<string>();

    for (const item of preparedUpdates) {
      const { data: updatedRows, error: updErr } = await supabase
        .from("bookings")
        .update({
          driver_id: item.targetDriver,
          home_service_tracking_status:
            item.priorRow.home_service_tracking_status === "awaiting_driver"
              ? "ready"
              : item.priorRow.home_service_tracking_status,
          metadata: item.nextMeta as Json,
        })
        .eq("id", item.update.bookingId)
        .eq("branch_id", branchId)
        .eq("home_service_tracking_status", item.priorRow.home_service_tracking_status)
        .select("id");

      if (updErr || !updatedRows || updatedRows.length === 0) {
        for (let i = appliedSnapshots.length - 1; i >= 0; i--) {
          const prev = appliedSnapshots[i]!;
          await supabase
            .from("bookings")
            .update({
              driver_id: prev.driver_id,
              home_service_tracking_status: prev.home_service_tracking_status,
              metadata: prev.metadata,
            })
            .eq("id", prev.id)
            .eq("branch_id", branchId);
        }
        return {
          ok: false,
          error:
            updErr?.message ||
            "Booking state changed or update permission denied during fallback plan commit; changes were rolled back.",
        };
      }

      appliedSnapshots.push(item.priorRow);
      committedCount++;
      driverSet.add(item.targetDriver);
    }
    notifiedDriverIds = Array.from(driverSet);
  }

  for (const dId of notifiedDriverIds) {
    void createNotification({
      targetWorkspace: "driver",
      recipientStaffId: dId,
      branchId,
      actorStaffId,
      type: "booking_status_changed",
      title: "Driver trip plan updated",
      body: "New pooled stop order or collection schedule is ready in Trips.",
      entityType: "branch",
      entityId: branchId,
      actionHref: "/driver",
      priority: "high",
      requiresAction: false,
      metadata: { snapshotId, branchId },
      dedupeKey: `o4_plan:${snapshotId}:${dId}`,
    });
  }

  if (process.env.CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED === "true") {
    void processDriverNativePush().catch(() => undefined);
  }

  return { ok: true, committedCount, notifiedDriverIds };
}

export async function updateBookingCollectionDisposition(args: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  actorStaffId: string;
  bookingId: string;
  decision: "required" | "not_required" | "undecided";
  collectionDriverId?: string | null;
  reasonCode?: string | null;
  notes?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    supabase,
    branchId,
    actorStaffId,
    bookingId,
    decision,
    collectionDriverId = null,
    reasonCode = null,
    notes = null,
  } = args;

  const nowIso = new Date().toISOString();
  const approval = {
    source: "crm_dispatch",
    reasonCode:
      reasonCode ??
      (decision === "not_required"
        ? "APPROVED_INDEPENDENT_DEPARTURE"
        : decision === "undecided"
          ? "CRM_PENDING_CONFIRMATION"
          : "CRM_CONFIRMED_COLLECTION"),
    approvedBy: decision === "not_required" ? actorStaffId : null,
    approvedAt: decision === "not_required" ? nowIso : null,
    notes: notes ?? null,
  };

  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED === "true") {
    const { error } = await supabase.rpc(
      "driver_o4_set_collection_decision" as never,
      {
        p_booking_id: bookingId,
        p_decision: decision,
        p_collection_driver_id: collectionDriverId,
        p_approval: approval,
      } as never
    );
    if (error) {
      return { ok: false, error: error.message || "Collection requirement update failed." };
    }
    if (process.env.CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED === "true") {
      void processDriverNativePush().catch(() => undefined);
    }
    return { ok: true };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, metadata")
    .eq("id", bookingId)
    .eq("branch_id", branchId)
    .single();
  if (!booking) return { ok: false, error: "Booking not found in this branch." };

  const meta = asRecord(booking.metadata) ?? {};
  const nextMeta = {
    ...meta,
    driver_collection: {
      decision,
      reasonCode: approval.reasonCode,
      source: approval.source,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      collectionDriverId,
      notes: approval.notes,
    },
  };

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ metadata: nextMeta as Json })
    .eq("id", bookingId)
    .eq("branch_id", branchId);
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true };
}
