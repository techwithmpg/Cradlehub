import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import {
  BRANCH_TIMEZONE,
  getBranchBusinessDate,
  getBranchClockTime,
  rangesOverlap,
  timeToMinutes,
} from "@/lib/engine/slot-time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  computeDynamicTransitionBuffer,
  DEFAULT_ROOM_RESET_BUFFER_MINUTES,
} from "./dynamic-buffer";
import { loadUnifiedOperationalSnapshot } from "./snapshot-loader";
import { solveOnsiteWithEngine } from "./client";

type MinimalSlot = {
  staff_id: string;
  slot_time: string;
  available: boolean;
};

type BlockingDayRow = {
  id: string;
  staff_id: string | null;
  resource_id: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  hold_expires_at: string | null;
  delivery_type: string | null;
  travel_buffer_mins: number | null;
  session_due_at: string | null;
  metadata: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isoToManilaMinutes(iso: string | null | undefined, date: string): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const dayStart = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(dayStart)) return null;
  return Math.max(0, Math.round((parsed - dayStart) / 60_000));
}

export async function getActiveRoomTurnoversForDate(params: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  date: string;
  now?: Date;
}): Promise<Map<string, number>> {
  const now = params.now ?? new Date();
  const today = getBranchBusinessDate(now);
  if (params.date !== today) return new Map();

  try {
    const [tasksRes, schedRes] = await Promise.all([
      params.supabase
        .from("workflow_tasks")
        .select("entity_id, created_at, metadata")
        .eq("branch_id", params.branchId)
        .eq("task_type", "room_turnover")
        .in("status", ["open", "in_progress"]),
      params.supabase
        .from("scheduling_rules")
        .select("room_reset_buffer_minutes")
        .eq("branch_id", params.branchId)
        .maybeSingle(),
    ]);

    if (tasksRes.error || !Array.isArray(tasksRes.data)) return new Map();

    const resetMins =
      schedRes.data?.room_reset_buffer_minutes ?? DEFAULT_ROOM_RESET_BUFFER_MINUTES;
    const nowMin = timeToMinutes(getBranchClockTime(now, BRANCH_TIMEZONE));
    const map = new Map<string, number>();

    for (const row of tasksRes.data) {
      if (!row.entity_id) continue;
      const meta = isRecord(row.metadata) ? row.metadata : {};
      const est =
        typeof meta.expected_minutes === "number" && meta.expected_minutes > 0
          ? meta.expected_minutes
          : Math.max(10, resetMins);
      const startedMin = isoToManilaMinutes(row.created_at, params.date) ?? nowMin;
      const readyMin = Math.max(nowMin, startedMin) + est;
      map.set(row.entity_id, Math.max(map.get(row.entity_id) ?? 0, readyMin));
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function filterSlotsByRoomAndHomeTravel<T extends MinimalSlot>(params: {
  supabase: SupabaseClient<Database>;
  branchId: string;
  date: string;
  deliveryMode: "in_spa" | "home_service";
  blockMinutes: number;
  slots: T[];
}): Promise<T[]> {
  if (params.slots.length === 0 || !params.slots.some((s) => s.available)) {
    return params.slots;
  }

  try {
    const now = new Date();
    const [resourcesRes, dayBookingsRes, rulesRes, schedRulesRes, turnoverReadyMap] =
      await Promise.all([
        params.supabase
          .from("branch_resources")
          .select("id, capacity")
          .eq("branch_id", params.branchId)
          .eq("is_active", true),
        params.supabase
          .from("bookings")
          .select(
            "id, staff_id, resource_id, start_time, end_time, status, hold_expires_at, delivery_type, travel_buffer_mins, session_due_at, metadata"
          )
          .eq("branch_id", params.branchId)
          .eq("booking_date", params.date),
        params.supabase
          .from("branch_booking_rules")
          .select("travel_buffer_mins")
          .eq("branch_id", params.branchId)
          .maybeSingle(),
        params.supabase
          .from("scheduling_rules")
          .select("home_service_travel_buffer_minutes, room_reset_buffer_minutes")
          .eq("branch_id", params.branchId)
          .maybeSingle(),
        getActiveRoomTurnoversForDate({
          supabase: params.supabase,
          branchId: params.branchId,
          date: params.date,
          now,
        }),
      ]);

    const activeResources =
      !resourcesRes.error && Array.isArray(resourcesRes.data) ? resourcesRes.data : [];
    const activeBookings =
      !dayBookingsRes.error && Array.isArray(dayBookingsRes.data)
        ? (dayBookingsRes.data as BlockingDayRow[]).filter((b) =>
            bookingBlocksAvailability(b, now)
          )
        : [];

    if (activeResources.length === 0 && activeBookings.length === 0) {
      return params.slots;
    }

    const branchTravelBuffer = rulesRes.data?.travel_buffer_mins ?? 30;
    const schedTravelBuffer = schedRulesRes.data?.home_service_travel_buffer_minutes ?? null;
    const roomResetMins = Math.max(
      0,
      Number(schedRulesRes.data?.room_reset_buffer_minutes ?? DEFAULT_ROOM_RESET_BUFFER_MINUTES)
    );

    // 1. Pre-compute therapist home-service travel windows & running session overrun windows
    const extraBusyByStaff = new Map<string, Array<{ start: number; end: number }>>();
    for (const b of activeBookings) {
      if (!b.staff_id) continue;
      const startMin = timeToMinutes(b.start_time);
      let endMin = timeToMinutes(b.end_time);
      if (endMin <= startMin) endMin += 1440;
      const dueMin = isoToManilaMinutes(b.session_due_at, params.date);
      const projectedEnd = Math.max(endMin, dueMin ?? endMin);

      if (b.delivery_type === "home_service") {
        const meta = isRecord(b.metadata) ? b.metadata : {};
        const dispatch = isRecord(meta.dispatch) ? meta.dispatch : {};
        const eta = parseLiveEta(dispatch);
        const buf = computeDynamicTransitionBuffer({
          deliveryType: "home_service",
          bookingStartTime: b.start_time,
          bookingEndTime: b.end_time,
          branchTravelBufferMinutes: branchTravelBuffer,
          schedulingHomeBufferMinutes: schedTravelBuffer,
          bookingTravelBufferMinutes: b.travel_buffer_mins,
          liveEtaMinutes: eta?.eta_minutes ?? null,
        });
        const list = extraBusyByStaff.get(b.staff_id) ?? [];
        list.push({
          start: buf.effectiveStartMinute,
          end: Math.max(buf.effectiveEndMinute, projectedEnd + buf.postBufferMinutes),
        });
        extraBusyByStaff.set(b.staff_id, list);
      } else if (projectedEnd > endMin) {
        const list = extraBusyByStaff.get(b.staff_id) ?? [];
        list.push({ start: startMin, end: projectedEnd });
        extraBusyByStaff.set(b.staff_id, list);
      }
    }

    // Cache per-slot-time room feasibility so we check rooms once per distinct HH:MM
    const roomFreeBySlotTime = new Map<string, boolean>();
    const hasRoomAtWindow = (slotStart: number, slotEnd: number): boolean => {
      if (params.deliveryMode !== "in_spa" || activeResources.length === 0) {
        return true;
      }
      return activeResources.some((res) => {
        const turnoverUntil = turnoverReadyMap.get(res.id);
        if (turnoverUntil !== undefined && slotStart < turnoverUntil) {
          return false;
        }
        const occ = activeBookings.filter((b) => {
          if (b.resource_id !== res.id) return false;
          const bStart = timeToMinutes(b.start_time);
          let bEnd = timeToMinutes(b.end_time);
          if (bEnd <= bStart) bEnd += 1440;
          const due = isoToManilaMinutes(b.session_due_at, params.date);
          return rangesOverlap(
            slotStart,
            slotEnd + roomResetMins,
            bStart,
            Math.max(bEnd, due ?? bEnd) + roomResetMins
          );
        }).length;
        return occ < res.capacity;
      });
    };

    return params.slots.map((slot) => {
      if (!slot.available) return slot;
      const slotStart = timeToMinutes(slot.slot_time);
      const slotEnd = slotStart + params.blockMinutes;

      const staffWindows = extraBusyByStaff.get(slot.staff_id) ?? [];
      if (staffWindows.some((w) => rangesOverlap(slotStart, slotEnd, w.start, w.end))) {
        return { ...slot, available: false };
      }

      const key = `${slotStart}:${slotEnd}`;
      let roomOk = roomFreeBySlotTime.get(key);
      if (roomOk === undefined) {
        roomOk = hasRoomAtWindow(slotStart, slotEnd);
        roomFreeBySlotTime.set(key, roomOk);
      }
      if (!roomOk) {
        return { ...slot, available: false };
      }

      return slot;
    });
  } catch {
    return params.slots;
  }
}

export type CrmRoomCapacitySummary = {
  enforced: boolean;
  totalActiveRooms: number;
  availableRooms: number;
  availableRoomSpots: number;
  activeTurnoverCount: number;
  recommendedRoomId: string | null;
  recommendedRoomName: string | null;
};

export type CrmNextBestAlternative = {
  kind: "earlier_slot" | "nearby_slot" | "alternate_staff_or_room";
  startTime: string;
  endTime: string;
  deltaMinutes: number;
  staffId: string;
  staffName: string;
  resourceId: string | null;
  resourceName: string | null;
  summary: string;
};

function fmtClock(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export async function getCrmRoomSummaryAndAlternatives(params: {
  branchId: string;
  date: string;
  serviceIds: string[];
  durationsMinutes: number[];
  requestedStartTime: string;
  deliveryType: "in_spa" | "home_service";
  preferredStaffId?: string;
  findAlternatives: boolean;
}): Promise<{
  roomSummary: CrmRoomCapacitySummary;
  alternatives: CrmNextBestAlternative[];
}> {
  const snapshot = await loadUnifiedOperationalSnapshot({
    branchId: params.branchId,
    date: params.date,
  });
  const reqStartMin = timeToMinutes(params.requestedStartTime);
  const totalDur = Math.max(
    15,
    params.durationsMinutes.reduce((a, b) => a + b, 0)
  );
  const reqEndMin = reqStartMin + totalDur;

  const activeResources = snapshot.request.resources.filter((r) => r.is_active);
  const turnoverMap = new Map<string, number>();
  for (const rt of snapshot.request.room_turnovers) {
    if (rt.status === "open" || rt.status === "in_progress") {
      turnoverMap.set(rt.resource_id, rt.expected_ready_minute);
    }
  }

  let availableRooms = 0;
  let availableRoomSpots = 0;
  let recommendedRoomId: string | null = null;
  let recommendedRoomName: string | null = null;
  const branchResetMins = snapshot.request.rules.room_reset_buffer_minutes;

  for (const res of activeResources) {
    const turnUntil = turnoverMap.get(res.resource_id) ?? res.active_turnover_until_minute;
    if (turnUntil !== null && reqStartMin < turnUntil) continue;
    const reset = res.reset_buffer_minutes ?? branchResetMins;
    const occ = res.busy_windows.filter((b) =>
      rangesOverlap(
        reqStartMin,
        reqEndMin + reset,
        b.start_minute,
        b.end_minute + (b.reset_after_minutes ?? reset)
      )
    ).length;
    const rem = Math.max(0, res.capacity - occ);
    if (rem > 0) {
      availableRooms += 1;
      availableRoomSpots += rem;
      if (!recommendedRoomId) {
        recommendedRoomId = res.resource_id;
        recommendedRoomName = res.name;
      }
    }
  }

  const roomSummary: CrmRoomCapacitySummary = {
    enforced: params.deliveryType === "in_spa" && activeResources.length > 0,
    totalActiveRooms: activeResources.length,
    availableRooms,
    availableRoomSpots,
    activeTurnoverCount: turnoverMap.size,
    recommendedRoomId,
    recommendedRoomName,
  };

  if (!params.findAlternatives || params.serviceIds.length === 0) {
    return { roomSummary, alternatives: [] };
  }

  const serviceBufferById = new Map<
    string,
    { name: string; bufferBefore: number; bufferAfter: number }
  >();
  try {
    const admin = createAdminClient();
    const { data: svcRows } = await admin
      .from("services")
      .select("id, name, buffer_before, buffer_after")
      .in("id", params.serviceIds);
    for (const s of svcRows ?? []) {
      serviceBufferById.set(s.id, {
        name: s.name ?? "Service",
        bufferBefore: Math.max(0, Number(s.buffer_before ?? 0)),
        bufferAfter: Math.max(0, Number(s.buffer_after ?? 0)),
      });
    }
  } catch {
    /* keep safe zero fallback when service lookup is unavailable in isolated unit tests */
  }

  const primaryServiceId = params.serviceIds[0]!;
  const solveRes = await solveOnsiteWithEngine({
    branch_id: params.branchId,
    date: params.date,
    branch_open_minute: snapshot.request.rules.in_spa_open_minute,
    branch_close_minute: snapshot.request.rules.in_spa_close_minute,
    slot_interval_minutes: 30,
    room_reset_buffer_minutes: snapshot.request.rules.room_reset_buffer_minutes,
    mode: "assign_order",
    requested_start_minute: reqStartMin,
    candidate_start_minutes: [],
    allow_alternative_times: true,
    allow_earlier_opportunities: true,
    max_alternatives: 4,
    enforce_room_capacity: params.deliveryType === "in_spa" && activeResources.length > 0,
    group_room_policy: "prefer_together",
    therapists: snapshot.request.therapists,
    resources: activeResources,
    requirements: params.serviceIds.map((svcId, idx) => {
      const svcMeta = serviceBufferById.get(svcId);
      return {
        line_id: `line-${idx}`,
        attendee_id: "att-1",
        line_index: idx,
        service_id: svcId,
        service_name:
          svcMeta?.name ?? (svcId === primaryServiceId ? "Service" : `Service ${idx + 1}`),
        duration_minutes: Math.max(15, params.durationsMinutes[idx] ?? 60),
        buffer_before_minutes: svcMeta?.bufferBefore ?? 0,
        buffer_after_minutes: svcMeta?.bufferAfter ?? 0,
        requires_room: params.deliveryType === "in_spa",
        preferred_staff_id: params.preferredStaffId ?? null,
        locked_staff_id: null,
        locked_resource_id: null,
        allowed_resource_types: [],
      };
    }),
  });

  const alternatives: CrmNextBestAlternative[] = solveRes.alternatives
    .filter((alt) => alt.assignments.length > 0)
    .map((alt) => {
      const first = alt.assignments[0]!;
      return {
        kind: alt.kind,
        startTime: fmtClock(alt.start_minute),
        endTime: fmtClock(alt.end_minute),
        deltaMinutes: alt.delta_minutes,
        staffId: first.staff_id,
        staffName: first.staff_name,
        resourceId: first.resource_id ?? null,
        resourceName: first.resource_name ?? null,
        summary: alt.summary,
      };
    });

  return { roomSummary, alternatives };
}
