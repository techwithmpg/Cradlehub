import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import {
  BRANCH_TIMEZONE,
  getBranchBusinessDate,
  getBranchClockTime,
  timeToMinutes,
} from "@/lib/engine/slot-time";

function fmtClockMinute(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
}
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  computeDynamicTransitionBuffer,
  DEFAULT_ROOM_RESET_BUFFER_MINUTES,
  haversineDistanceKm,
} from "./dynamic-buffer";
import type {
  CrossBranchAssistanceInput,
  OnsiteResourceInput,
  OnsiteTherapistInput,
  RoomTurnoverTaskInput,
  TimeWindow,
  UnifiedBookingInput,
  UnifiedDriverInput,
  UnifiedEvaluateRequest,
} from "./types";

const MANILA_OFFSET = "+08:00";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getBranchDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function isoToBranchMinute(iso: string | null | undefined, date: string): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const dayStartMs = Date.parse(`${date}T00:00:00${MANILA_OFFSET}`);
  if (!Number.isFinite(dayStartMs)) return null;
  return Math.max(0, Math.min(2880, Math.round((parsed - dayStartMs) / 60_000)));
}

function clockRangeToWindow(
  startClock: string | null | undefined,
  endClock: string | null | undefined,
  endsNextDay?: boolean | null
): TimeWindow | null {
  if (!startClock || !endClock) return null;
  const start = timeToMinutes(startClock);
  let end = timeToMinutes(endClock);
  if (endsNextDay || end <= start) {
    end += 1440;
  }
  if (end <= start) return null;
  return { start_minute: start, end_minute: Math.min(2880, end) };
}

function extractCustomerLocation(
  metadata: unknown
): { lat: number; lng: number } | null {
  if (!isRecord(metadata)) return null;
  const addr = isRecord(metadata.home_service_address)
    ? metadata.home_service_address
    : null;
  const dispatch = isRecord(metadata.dispatch) ? metadata.dispatch : null;
  const lat =
    (typeof addr?.lat === "number" ? addr.lat : null) ??
    (typeof dispatch?.lat === "number" ? dispatch.lat : null);
  const lng =
    (typeof addr?.lng === "number" ? addr.lng : null) ??
    (typeof dispatch?.lng === "number" ? dispatch.lng : null);
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }
  return null;
}

function extractCustomerName(
  customers: unknown,
  attendee: unknown,
  metadata: unknown
): string {
  const attRec = Array.isArray(attendee) ? attendee[0] : attendee;
  if (isRecord(attRec) && typeof attRec.display_name === "string" && attRec.display_name.trim()) {
    return attRec.display_name.trim();
  }
  const custRec = Array.isArray(customers) ? customers[0] : customers;
  if (isRecord(custRec) && typeof custRec.full_name === "string" && custRec.full_name.trim()) {
    return custRec.full_name.trim();
  }
  if (isRecord(metadata) && typeof metadata.guest_name === "string" && metadata.guest_name.trim()) {
    return metadata.guest_name.trim();
  }
  return "Guest";
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type LoadedBranchSnapshot = {
  request: UnifiedEvaluateRequest;
  nowIso: string;
  driverHomeBranchMap: Map<string, string>;
  branchLocation: { lat: number; lng: number } | null;
};

export async function loadUnifiedOperationalSnapshot(params: {
  branchId: string;
  date?: string;
  now?: Date;
  supabase?: SupabaseClient<Database>;
}): Promise<LoadedBranchSnapshot> {
  const db = params.supabase ?? createAdminClient();
  const now = params.now ?? new Date();
  const date = params.date ?? getBranchBusinessDate(now);
  const dow = getBranchDayOfWeek(date);
  const nowMinute =
    date === getBranchBusinessDate(now)
      ? timeToMinutes(getBranchClockTime(now, BRANCH_TIMEZONE))
      : date < getBranchBusinessDate(now)
        ? 1440
        : 0;

  const dayStartIso = `${date}T00:00:00${MANILA_OFFSET}`;
  const dayEndIso = `${date}T23:59:59${MANILA_OFFSET}`;

  const [
    branchRes,
    bookingRulesRes,
    schedRulesRes,
    resourcesRes,
    staffRes,
    staffServicesRes,
    bookingsRes,
    checkinsRes,
    turnoversRes,
    locationsRes,
    assistanceRes,
  ] = await Promise.all([
    db
      .from("branches")
      .select("id, name, latitude, longitude, slot_interval_minutes")
      .eq("id", params.branchId)
      .maybeSingle(),
    db
      .from("branch_booking_rules")
      .select(
        "travel_buffer_mins, in_spa_start_time, in_spa_end_time, home_service_start_time, home_service_end_time, home_service_enabled"
      )
      .eq("branch_id", params.branchId)
      .maybeSingle(),
    db
      .from("scheduling_rules")
      .select(
        "home_service_travel_buffer_minutes, room_reset_buffer_minutes, min_daily_therapists, max_services_per_staff_per_day, max_working_hours_per_day"
      )
      .eq("branch_id", params.branchId)
      .maybeSingle(),
    db
      .from("branch_resources")
      .select("id, name, type, capacity, sort_order, is_active")
      .eq("branch_id", params.branchId)
      .eq("is_active", true)
      .order("sort_order"),
    db
      .from("staff")
      .select(
        "id, full_name, nickname, branch_id, system_role, staff_type, is_active, tier, created_at, archived_at, merged_into_staff_id"
      )
      .eq("is_active", true)
      .is("archived_at", null)
      .is("merged_into_staff_id", null),
    db.from("staff_services").select("staff_id, service_id"),
    db
      .from("bookings")
      .select(
        "id, order_id, branch_id, service_id, staff_id, therapist_selection_source, requested_staff_id, driver_id, resource_id, booking_date, start_time, end_time, status, booking_progress_status, hold_expires_at, delivery_type, travel_buffer_mins, session_started_at, session_due_at, session_duration_minutes_snapshot, metadata, customers(full_name), services(name, duration_minutes, buffer_before, buffer_after), booking_attendees(display_name)"
      )
      .eq("branch_id", params.branchId)
      .eq("booking_date", date),
    db
      .from("staff_shift_checkins")
      .select("staff_id, shift_date, checked_in_at, checked_out_at, status")
      .eq("branch_id", params.branchId)
      .eq("shift_date", date),
    db
      .from("workflow_tasks")
      .select("id, entity_id, title, status, created_at, metadata")
      .eq("branch_id", params.branchId)
      .eq("task_type", "room_turnover")
      .in("status", ["open", "in_progress"]),
    db
      .from("staff_location_snapshots")
      .select("staff_id, lat, lng, accuracy_meters, recorded_at, source")
      .eq("branch_id", params.branchId)
      .order("recorded_at", { ascending: false })
      .limit(120),
    (db as unknown as SupabaseClient)
      .from("staff_assistance_requests")
      .select(
        "id, requesting_branch_id, lending_branch_id, status, visit_type, start_at, end_at, selected_staff_ids"
      )
      .or(
        `requesting_branch_id.eq.${params.branchId},lending_branch_id.eq.${params.branchId}`
      )
      .lte("start_at", dayEndIso)
      .gte("end_at", dayStartIso),
  ]);

  if (branchRes.error || !branchRes.data) {
    throw new Error(branchRes.error?.message ?? "Branch could not be loaded for optimization.");
  }
  if (staffRes.error) {
    throw new Error(`Staff query failed during optimization: ${staffRes.error.message}`);
  }
  if (bookingsRes.error) {
    throw new Error(`Bookings query failed during optimization: ${bookingsRes.error.message}`);
  }
  if (resourcesRes.error) {
    throw new Error(`Resources query failed during optimization: ${resourcesRes.error.message}`);
  }

  const allActiveStaff = staffRes.data ?? [];
  const assistanceRows = Array.isArray(assistanceRes.data) ? assistanceRes.data : [];

  const relevantStaffIds = new Set<string>();
  for (const s of allActiveStaff) {
    if (s.branch_id === params.branchId) relevantStaffIds.add(s.id);
  }
  // Stage B staff_assistance_requests (`approved_pending_arrival`) are provisional only and must NOT grant bookable capacity until transfer activation.
  const staffIds = Array.from(relevantStaffIds);

  const [schedulesRes, overridesRes, blocksRes] =
    staffIds.length > 0
      ? await Promise.all([
          db
            .from("staff_schedules")
            .select("staff_id, start_time, end_time, ends_next_day, is_active, day_of_week")
            .in("staff_id", staffIds)
            .eq("day_of_week", dow)
            .eq("is_active", true),
          db
            .from("schedule_overrides")
            .select("staff_id, start_time, end_time, ends_next_day, is_day_off")
            .in("staff_id", staffIds)
            .eq("override_date", date),
          db
            .from("blocked_times")
            .select("staff_id, start_time, end_time")
            .in("staff_id", staffIds)
            .eq("block_date", date),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (schedulesRes.error) throw new Error(schedulesRes.error.message);
  if (overridesRes.error) throw new Error(overridesRes.error.message);
  if (blocksRes.error) throw new Error(blocksRes.error.message);

  const qualifiedByStaff = new Map<string, string[]>();
  for (const row of staffServicesRes.data ?? []) {
    const arr = qualifiedByStaff.get(row.staff_id) ?? [];
    arr.push(row.service_id);
    qualifiedByStaff.set(row.staff_id, arr);
  }

  const schedulesByStaff = new Map<string, TimeWindow[]>();
  for (const row of schedulesRes.data ?? []) {
    const win = clockRangeToWindow(row.start_time, row.end_time, row.ends_next_day);
    if (!win) continue;
    const arr = schedulesByStaff.get(row.staff_id) ?? [];
    arr.push(win);
    schedulesByStaff.set(row.staff_id, arr);
  }

  const overridesByStaff = new Map<string, { isDayOff: boolean; windows: TimeWindow[] }>();
  for (const row of overridesRes.data ?? []) {
    const cur = overridesByStaff.get(row.staff_id) ?? { isDayOff: false, windows: [] };
    if (row.is_day_off) {
      cur.isDayOff = true;
    } else {
      const win = clockRangeToWindow(row.start_time, row.end_time, row.ends_next_day);
      if (win) cur.windows.push(win);
    }
    overridesByStaff.set(row.staff_id, cur);
  }

  const blocksByStaff = new Map<string, TimeWindow[]>();
  for (const row of blocksRes.data ?? []) {
    const win = clockRangeToWindow(row.start_time, row.end_time, false);
    if (win) {
      const arr = blocksByStaff.get(row.staff_id) ?? [];
      arr.push(win);
      blocksByStaff.set(row.staff_id, arr);
    }
  }

  const checkedInStaff = new Set<string>();
  for (const ck of checkinsRes.data ?? []) {
    if (!ck.checked_out_at && ck.status !== "checked_out") {
      checkedInStaff.add(ck.staff_id);
    }
  }

  const latestGpsByStaff = new Map<
    string,
    { lat: number; lng: number; accuracyMeters: number | null; ageSeconds: number }
  >();
  for (const snap of locationsRes.data ?? []) {
    if (latestGpsByStaff.has(snap.staff_id)) continue;
    const recMs = Date.parse(snap.recorded_at);
    const ageSeconds = Number.isFinite(recMs)
      ? Math.max(0, Math.round((now.getTime() - recMs) / 1000))
      : 999_999;
    latestGpsByStaff.set(snap.staff_id, {
      lat: snap.lat,
      lng: snap.lng,
      accuracyMeters: snap.accuracy_meters,
      ageSeconds,
    });
  }

  const branchLat = branchRes.data.latitude;
  const branchLng = branchRes.data.longitude;
  const branchLocation =
    typeof branchLat === "number" && typeof branchLng === "number"
      ? { lat: branchLat, lng: branchLng }
      : null;

  const schedRules = schedRulesRes.data;
  const bookingRules = bookingRulesRes.data;
  const roomResetBuffer =
    schedRules?.room_reset_buffer_minutes ?? DEFAULT_ROOM_RESET_BUFFER_MINUTES;
  const inSpaOpenMin = bookingRules?.in_spa_start_time
    ? timeToMinutes(bookingRules.in_spa_start_time)
    : 600;
  let inSpaCloseMin = bookingRules?.in_spa_end_time
    ? timeToMinutes(bookingRules.in_spa_end_time)
    : 1350;
  if (inSpaCloseMin <= inSpaOpenMin) inSpaCloseMin += 1440;

  const activeBookingsRaw = (bookingsRes.data ?? []).filter((b) =>
    bookingBlocksAvailability(b, now)
  );
  const completedCountByStaff = new Map<string, number>();
  const serviceMinutesByStaff = new Map<string, number>();
  for (const b of bookingsRes.data ?? []) {
    if (b.staff_id && b.status === "completed") {
      completedCountByStaff.set(
        b.staff_id,
        (completedCountByStaff.get(b.staff_id) ?? 0) + 1
      );
    }
    if (b.staff_id && bookingBlocksAvailability(b, now)) {
      const dur = Math.max(
        15,
        timeToMinutes(b.end_time) - timeToMinutes(b.start_time)
      );
      serviceMinutesByStaff.set(
        b.staff_id,
        (serviceMinutesByStaff.get(b.staff_id) ?? 0) + dur
      );
    }
  }

  const roomTurnovers: RoomTurnoverTaskInput[] = (turnoversRes.data ?? [])
    .filter((t) => Boolean(t.entity_id))
    .map((t) => {
      const startMin = isoToBranchMinute(t.created_at, date) ?? Math.max(0, nowMinute - 10);
      const meta = isRecord(t.metadata) ? t.metadata : {};
      const estMins =
        typeof meta.expected_minutes === "number" && meta.expected_minutes > 0
          ? meta.expected_minutes
          : Math.max(10, roomResetBuffer);
      return {
        task_id: t.id,
        resource_id: t.entity_id!,
        resource_name: t.title ?? "Room",
        status:
          t.status === "in_progress"
            ? "in_progress"
            : t.status === "open"
              ? "open"
              : "resolved",
        started_minute: startMin,
        expected_ready_minute: Math.max(nowMinute, startMin) + estMins,
      };
    });

  const turnoverMap = new Map<string, number>();
  for (const rt of roomTurnovers) {
    turnoverMap.set(
      rt.resource_id,
      Math.max(turnoverMap.get(rt.resource_id) ?? 0, rt.expected_ready_minute)
    );
  }

  const roomBusyByResource = new Map<
    string,
    Array<{ booking_id: string; start_minute: number; end_minute: number; reset_after_minutes: number }>
  >();

  const bookings: UnifiedBookingInput[] = activeBookingsRaw.map((b) => {
    const startMin = timeToMinutes(b.start_time);
    let endMin = timeToMinutes(b.end_time);
    if (endMin <= startMin) endMin += 1440;
    const svc = firstRelation(b.services);
    const meta = isRecord(b.metadata) ? b.metadata : {};
    const dispatchMeta = isRecord(meta.dispatch) ? meta.dispatch : {};
    const hsEta = parseLiveEta(dispatchMeta);
    const custLoc = extractCustomerLocation(meta);
    const distKm =
      custLoc && branchLocation ? haversineDistanceKm(branchLocation, custLoc) : null;

    const trackingStatus =
      typeof dispatchMeta.status === "string"
        ? dispatchMeta.status
        : b.booking_progress_status;
    const dueMin = isoToBranchMinute(b.session_due_at, date);
    const startedMin = isoToBranchMinute(b.session_started_at, date);
    const dur =
      b.session_duration_minutes_snapshot && b.session_duration_minutes_snapshot > 0
        ? b.session_duration_minutes_snapshot
        : (svc?.duration_minutes ?? Math.max(30, endMin - startMin));

    if (b.resource_id && b.delivery_type !== "home_service") {
      const list = roomBusyByResource.get(b.resource_id) ?? [];
      list.push({
        booking_id: b.id,
        start_minute: startMin,
        end_minute: Math.max(endMin, dueMin ?? endMin),
        reset_after_minutes: roomResetBuffer,
      });
      roomBusyByResource.set(b.resource_id, list);
    }

    const rawCollection = isRecord(meta.driver_collection) ? meta.driver_collection : null;
    const rawColDecision = rawCollection?.decision;
    const collectionDecision: "required" | "not_required" | "undecided" | null =
      rawColDecision === "required" ||
      rawColDecision === "not_required" ||
      rawColDecision === "undecided"
        ? rawColDecision
        : null;
    const collectionDriverId =
      typeof rawCollection?.collectionDriverId === "string"
        ? rawCollection.collectionDriverId
        : null;

    return {
      booking_id: b.id,
      order_id: b.order_id,
      customer_name: extractCustomerName(b.customers, b.booking_attendees, meta),
      service_id: b.service_id,
      service_name: svc?.name ?? "Service",
      delivery_type: b.delivery_type === "home_service" ? "home_service" : "in_spa",
      status: b.status,
      booking_progress_status: b.booking_progress_status,
      tracking_status: trackingStatus ?? null,
      therapist_id: b.staff_id,
      therapist_selection_source: (() => {
        const colSource = (b as { therapist_selection_source?: unknown }).therapist_selection_source;
        const metaSource =
          isRecord(meta._therapist_provenance) &&
          typeof meta._therapist_provenance.therapist_selection_source === "string"
            ? meta._therapist_provenance.therapist_selection_source
            : null;
        if (typeof colSource === "string" && colSource !== "legacy_unknown") {
          return colSource;
        }
        return metaSource ?? (typeof colSource === "string" ? colSource : null);
      })(),
      driver_id: b.driver_id,
      collection_driver_id: collectionDriverId,
      resource_id: b.resource_id,
      start_minute: startMin,
      end_minute: endMin,
      duration_minutes: dur,
      buffer_before_minutes: svc?.buffer_before ?? 0,
      buffer_after_minutes: svc?.buffer_after ?? 0,
      travel_buffer_minutes: b.travel_buffer_mins,
      live_eta_minutes: hsEta?.eta_minutes ?? null,
      distance_km: distKm,
      session_started_minute: startedMin,
      session_due_minute: dueMin,
      projected_end_minute:
        b.status === "in_progress" || b.booking_progress_status === "service_started"
          ? Math.max(endMin, dueMin ?? endMin, nowMinute + 5)
          : null,
      collection_decision: collectionDecision,
      has_valid_customer_location:
        b.delivery_type !== "home_service" || custLoc !== null,
      requires_room: b.delivery_type !== "home_service",
    };
  });

  const assistanceInputs: CrossBranchAssistanceInput[] = assistanceRows.map((a) => ({
    request_id: String(a.id),
    requesting_branch_id: String(a.requesting_branch_id),
    lending_branch_id: String(a.lending_branch_id),
    status: String(a.status),
    visit_type:
      a.visit_type === "home_service" || a.visit_type === "both"
        ? a.visit_type
        : "in_spa",
    start_minute: isoToBranchMinute(String(a.start_at), date) ?? inSpaOpenMin,
    end_minute: isoToBranchMinute(String(a.end_at), date) ?? inSpaCloseMin,
    selected_staff_ids: Array.isArray(a.selected_staff_ids)
      ? a.selected_staff_ids.filter((x: unknown): x is string => typeof x === "string")
      : [],
  }));

  const therapists: OnsiteTherapistInput[] = [];
  const drivers: UnifiedDriverInput[] = [];
  const driverHomeBranchMap = new Map<string, string>();

  for (const s of allActiveStaff) {
    if (!relevantStaffIds.has(s.id)) continue;
    const ov = overridesByStaff.get(s.id);
    const shiftWindows = ov
      ? ov.isDayOff
        ? []
        : ov.windows
      : (schedulesByStaff.get(s.id) ?? []);

    if (s.system_role === "driver" || s.staff_type === "driver") {
      driverHomeBranchMap.set(s.id, s.branch_id ?? params.branchId);
      const gps = latestGpsByStaff.get(s.id);
      drivers.push({
        driver_id: s.id,
        name: s.nickname?.trim() || s.full_name,
        home_branch_id: s.branch_id ?? params.branchId,
        allowed_branch_ids: [params.branchId],
        shift_windows: shiftWindows,
        checked_in: checkedInStaff.has(s.id),
        gps_age_seconds: gps?.ageSeconds ?? null,
        gps_accuracy_meters: gps?.accuracyMeters ?? null,
        gps_offline: false,
        gps_permission_missing: false,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
      });
      continue;
    }

    if (s.system_role === "digital_marketer" || s.system_role === "utility") {
      continue;
    }

    // Only Stage C active assistance grants cross-branch therapist windows; Stage B `approved_pending_arrival` remains warning-only in `assistance_requests`.
    const assistWins = assistanceInputs
      .filter(
        (a) =>
          (a.status === "active" || a.status === "checked_in" || a.status === "arrived") &&
          a.selected_staff_ids.includes(s.id)
      )
      .map((a) => ({
        requesting_branch_id: a.requesting_branch_id,
        start_minute: a.start_minute,
        end_minute: a.end_minute,
        visit_type: a.visit_type,
      }));

    const seniorityRank =
      s.tier === "senior" ? 1 : s.tier === "mid" ? 2 : 3;

    therapists.push({
      staff_id: s.id,
      name: s.nickname?.trim() || s.full_name,
      home_branch_id: s.branch_id ?? params.branchId,
      seniority_rank: seniorityRank,
      completed_count_today: completedCountByStaff.get(s.id) ?? 0,
      checked_in: checkedInStaff.has(s.id),
      qualified_service_ids: qualifiedByStaff.get(s.id) ?? [],
      shift_windows: shiftWindows,
      break_windows: [],
      blocked_windows: blocksByStaff.get(s.id) ?? [],
      assistance_windows: assistWins,
      busy_windows: bookings
        .filter((bk) => bk.therapist_id === s.id)
        .map((bk) => {
          const dyn = computeDynamicTransitionBuffer({
            deliveryType: bk.delivery_type,
            bookingStartTime: fmtClockMinute(bk.start_minute),
            bookingEndTime: fmtClockMinute(bk.end_minute % 1440),
            bufferBeforeMinutes: bk.buffer_before_minutes,
            bufferAfterMinutes: bk.buffer_after_minutes,
            branchTravelBufferMinutes: bookingRules?.travel_buffer_mins ?? 30,
            schedulingHomeBufferMinutes: schedRules?.home_service_travel_buffer_minutes ?? null,
            bookingTravelBufferMinutes: bk.travel_buffer_minutes,
            liveEtaMinutes: bk.live_eta_minutes,
            distanceKm: bk.distance_km,
            collectionDecision: bk.collection_decision,
          });
          return {
            booking_id: bk.booking_id,
            start_minute: bk.start_minute,
            end_minute: bk.end_minute,
            effective_start_minute: dyn.effectiveStartMinute,
            effective_end_minute: dyn.effectiveEndMinute,
            delivery_type: bk.delivery_type,
            resource_id: bk.resource_id,
            is_active_session:
              bk.status === "in_progress" ||
              bk.booking_progress_status === "service_started",
          };
        }),
      max_services_per_day: schedRules?.max_services_per_staff_per_day ?? null,
      max_working_minutes_per_day: schedRules?.max_working_hours_per_day
        ? Math.round(Number(schedRules.max_working_hours_per_day) * 60)
        : null,
      existing_service_count_today: bookings.filter((bk) => bk.therapist_id === s.id).length,
      existing_working_minutes_today: serviceMinutesByStaff.get(s.id) ?? 0,
    });
  }

  const resources: OnsiteResourceInput[] = (resourcesRes.data ?? []).map((r) => ({
    resource_id: r.id,
    name: r.name,
    resource_type: r.type,
    capacity: r.capacity,
    sort_order: r.sort_order,
    is_active: r.is_active,
    allowed_service_ids: [],
    active_turnover_until_minute: turnoverMap.get(r.id) ?? null,
    turnover_start_minute: null,
    reset_buffer_minutes: roomResetBuffer,
    busy_windows: roomBusyByResource.get(r.id) ?? [],
  }));

  const basePayload = {
    branch_id: params.branchId,
    branch_name: branchRes.data.name,
    date,
    now_minute: nowMinute,
    rules: {
      travel_buffer_minutes: bookingRules?.travel_buffer_mins ?? 30,
      scheduling_home_buffer_minutes: schedRules?.home_service_travel_buffer_minutes ?? null,
      room_reset_buffer_minutes: roomResetBuffer,
      in_spa_open_minute: inSpaOpenMin,
      in_spa_close_minute: inSpaCloseMin,
      home_open_minute: bookingRules?.home_service_start_time
        ? timeToMinutes(bookingRules.home_service_start_time)
        : null,
      home_close_minute: bookingRules?.home_service_end_time
        ? timeToMinutes(bookingRules.home_service_end_time)
        : null,
      min_daily_therapists: schedRules?.min_daily_therapists ?? 1,
    },
    therapists,
    drivers,
    resources,
    bookings,
    room_turnovers: roomTurnovers,
    assistance_requests: assistanceInputs,
  };

  const hash = createHash("sha256")
    .update(JSON.stringify(basePayload))
    .digest("hex")
    .slice(0, 16);

  return {
    request: {
      ...basePayload,
      source_snapshot_version: `${date}:${hash}`,
    },
    nowIso: now.toISOString(),
    driverHomeBranchMap,
    branchLocation,
  };
}
