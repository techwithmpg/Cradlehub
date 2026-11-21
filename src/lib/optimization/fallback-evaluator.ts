import { computeDynamicTransitionBuffer } from "./dynamic-buffer";
import type {
  DynamicBufferDetail,
  OnsiteAlternativeSuggestion,
  OnsiteAssignmentLine,
  OnsiteResourceInput,
  OnsiteServiceRequirement,
  OnsiteSlotAvailability,
  OnsiteSolveRequest,
  OnsiteSolveResponse,
  OnsiteTherapistInput,
  PredictiveConflictItem,
  RecommendedStaffAction,
  UnifiedBookingInput,
  UnifiedEvaluateRequest,
  UnifiedEvaluateResponse,
} from "./types";

type LineWindow = {
  line: OnsiteServiceRequirement;
  startMinute: number;
  endMinute: number;
};

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0;
}

function fmtMinute(minute: number): string {
  const m = Math.max(0, Math.round(minute));
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function buildLineWindows(
  requirements: OnsiteServiceRequirement[],
  orderStartMinute: number
): LineWindow[] {
  const attendeeOrder: string[] = [];
  const byAtt = new Map<string, OnsiteServiceRequirement[]>();
  for (const req of requirements) {
    if (!byAtt.has(req.attendee_id)) {
      attendeeOrder.push(req.attendee_id);
      byAtt.set(req.attendee_id, []);
    }
    byAtt.get(req.attendee_id)!.push(req);
  }

  const out: LineWindow[] = [];
  for (const attId of attendeeOrder) {
    const lines = [...(byAtt.get(attId) ?? [])].sort(
      (a, b) => a.line_index - b.line_index || a.line_id.localeCompare(b.line_id)
    );
    let cursor = orderStartMinute;
    for (const line of lines) {
      const span =
        line.buffer_before_minutes + line.duration_minutes + line.buffer_after_minutes;
      out.push({ line, startMinute: cursor, endMinute: cursor + span });
      cursor += span;
    }
  }
  return out;
}

function isTherapistAuthorizedForBranch(
  therapist: OnsiteTherapistInput,
  branchId: string,
  startMinute: number,
  endMinute: number
): boolean {
  if (
    therapist.assistance_windows.some(
      (w) =>
        w.requesting_branch_id !== branchId &&
        overlaps(startMinute, endMinute, w.start_minute, w.end_minute)
    )
  ) {
    return false;
  }
  if (therapist.home_branch_id === branchId) return true;
  return therapist.assistance_windows.some(
    (w) =>
      w.requesting_branch_id === branchId &&
      (w.visit_type === "in_spa" || w.visit_type === "both") &&
      startMinute >= w.start_minute &&
      endMinute <= w.end_minute
  );
}

function checkTherapistEligibility(
  therapist: OnsiteTherapistInput,
  branchId: string,
  lw: LineWindow,
  addedServices: number,
  addedMinutes: number
): { ok: boolean; reason?: string } {
  const { line } = lw;
  if (line.locked_staff_id && therapist.staff_id !== line.locked_staff_id) {
    return { ok: false, reason: "locked_staff_mismatch" };
  }
  if (
    therapist.qualified_service_ids.length === 0 ||
    !therapist.qualified_service_ids.includes(line.service_id)
  ) {
    return { ok: false, reason: "not_qualified" };
  }
  if (!isTherapistAuthorizedForBranch(therapist, branchId, lw.startMinute, lw.endMinute)) {
    return { ok: false, reason: "cross_branch_unavailable" };
  }
  const inShift = therapist.shift_windows.some(
    (sw) => lw.startMinute >= sw.start_minute && lw.endMinute <= sw.end_minute
  );
  if (!inShift) return { ok: false, reason: "outside_shift" };

  if (
    therapist.break_windows.some((bw) =>
      overlaps(lw.startMinute, lw.endMinute, bw.start_minute, bw.end_minute)
    )
  ) {
    return { ok: false, reason: "break_or_block_overlap" };
  }
  if (
    therapist.blocked_windows.some((bw) =>
      overlaps(lw.startMinute, lw.endMinute, bw.start_minute, bw.end_minute)
    )
  ) {
    return { ok: false, reason: "break_or_block_overlap" };
  }

  for (const busy of therapist.busy_windows) {
    if (
      overlaps(
        lw.startMinute,
        lw.endMinute,
        busy.effective_start_minute,
        busy.effective_end_minute
      )
    ) {
      return {
        ok: false,
        reason:
          busy.delivery_type === "home_service"
            ? "home_service_transition_gap"
            : "therapist_conflict",
      };
    }
  }

  if (
    therapist.max_services_per_day !== null &&
    therapist.existing_service_count_today + addedServices + 1 >
      therapist.max_services_per_day
  ) {
    return { ok: false, reason: "max_services_limit" };
  }
  if (
    therapist.max_working_minutes_per_day !== null &&
    therapist.existing_working_minutes_today +
      addedMinutes +
      (lw.endMinute - lw.startMinute) >
      therapist.max_working_minutes_per_day
  ) {
    return { ok: false, reason: "max_working_hours_limit" };
  }
  return { ok: true };
}

function getRemainingRoomCapacity(
  resource: OnsiteResourceInput,
  startMinute: number,
  endMinute: number,
  defaultReset: number,
  extraBookings: Array<{ start: number; end: number; reset: number }> = []
): number {
  const reset = resource.reset_buffer_minutes ?? defaultReset;
  const probeEnd = endMinute + reset;
  const intervals = [
    ...resource.busy_windows.map((b) => ({
      start: b.start_minute,
      end: b.end_minute + b.reset_after_minutes,
    })),
    ...extraBookings.map((b) => ({ start: b.start, end: b.end + b.reset })),
  ].filter((iv) => overlaps(startMinute, probeEnd, iv.start, iv.end));

  if (intervals.length === 0) return resource.capacity;
  const checkPoints = new Set<number>([startMinute]);
  for (const iv of intervals) {
    if (iv.start > startMinute && iv.start < probeEnd) checkPoints.add(iv.start);
  }
  let peak = 0;
  for (const pt of checkPoints) {
    const occ = intervals.filter((iv) => iv.start <= pt && pt < iv.end).length;
    if (occ > peak) peak = occ;
  }
  return Math.max(0, resource.capacity - peak);
}

function solveFixedStartFallback(
  req: OnsiteSolveRequest,
  startMinute: number
): {
  feasible: boolean;
  assignments: OnsiteAssignmentLine[];
  reasons: string[];
  eligibleFirstStaffIds: string[];
  roomMode: OnsiteSolveResponse["room_constraint_mode"];
} {
  const windows = buildLineWindows(req.requirements, startMinute);
  if (windows.length === 0) {
    return {
      feasible: false,
      assignments: [],
      reasons: ["no_requirements"],
      eligibleFirstStaffIds: [],
      roomMode: "enforced",
    };
  }

  const minStart = Math.min(...windows.map((w) => w.startMinute));
  const maxEnd = Math.max(...windows.map((w) => w.endMinute));
  if (minStart < req.branch_open_minute || maxEnd > req.branch_close_minute) {
    return {
      feasible: false,
      assignments: [],
      reasons: ["outside_branch_hours"],
      eligibleFirstStaffIds: [],
      roomMode: "enforced",
    };
  }

  const activeResources = req.resources
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const anyRequiresRoom = windows.some((w) => w.line.requires_room);
  const roomMode: OnsiteSolveResponse["room_constraint_mode"] = !anyRequiresRoom
    ? "not_required"
    : !req.enforce_room_capacity || activeResources.length === 0
      ? "unconstrained_no_resources"
      : "enforced";

  const reasons = new Set<string>();
  const staffChosenWindows = new Map<string, Array<{ start: number; end: number }>>();
  const staffAddedCount = new Map<string, number>();
  const staffAddedMins = new Map<string, number>();
  const roomChosenWindows = new Map<
    string,
    Array<{ start: number; end: number; reset: number }>
  >();

  // Backtracking exact search (fast for single & multi-guest bookings)
  const sortedTherapistsForLine = (lw: LineWindow): OnsiteTherapistInput[] =>
    [...req.therapists].sort((a, b) => {
      const aPref = lw.line.preferred_staff_id === a.staff_id ? 0 : 1;
      const bPref = lw.line.preferred_staff_id === b.staff_id ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      if (a.checked_in !== b.checked_in) return a.checked_in ? -1 : 1;
      if (a.completed_count_today !== b.completed_count_today) {
        return a.completed_count_today - b.completed_count_today;
      }
      return a.seniority_rank - b.seniority_rank;
    });

  const assignments: OnsiteAssignmentLine[] = [];

  function backtrack(idx: number): boolean {
    if (idx === windows.length) return true;
    const lw = windows[idx]!;
    const candidatesT = sortedTherapistsForLine(lw);
    let anyT = false;

    for (const therapist of candidatesT) {
      const prevWins = staffChosenWindows.get(therapist.staff_id) ?? [];
      if (prevWins.some((w) => overlaps(lw.startMinute, lw.endMinute, w.start, w.end))) {
        continue;
      }
      const addedCount = staffAddedCount.get(therapist.staff_id) ?? 0;
      const addedMins = staffAddedMins.get(therapist.staff_id) ?? 0;
      const check = checkTherapistEligibility(
        therapist,
        req.branch_id,
        lw,
        addedCount,
        addedMins
      );
      if (!check.ok) {
        if (check.reason) reasons.add(check.reason);
        continue;
      }
      anyT = true;

      let candidateRooms: Array<OnsiteResourceInput | null> = [null];
      if (roomMode === "enforced" && lw.line.requires_room) {
        const rooms = activeResources.filter((r) => {
          if (lw.line.locked_resource_id && r.resource_id !== lw.line.locked_resource_id) {
            return false;
          }
          if (
            r.allowed_service_ids.length > 0 &&
            !r.allowed_service_ids.includes(lw.line.service_id)
          ) {
            return false;
          }
          if (
            lw.line.allowed_resource_types.length > 0 &&
            !lw.line.allowed_resource_types.includes(r.resource_type)
          ) {
            return false;
          }
          if (
            r.active_turnover_until_minute !== null &&
            overlaps(
              lw.startMinute,
              lw.endMinute,
              r.turnover_start_minute ?? 0,
              r.active_turnover_until_minute
            )
          ) {
            reasons.add("room_turnover_active");
            return false;
          }
          const rem = getRemainingRoomCapacity(
            r,
            lw.startMinute,
            lw.endMinute,
            req.room_reset_buffer_minutes,
            roomChosenWindows.get(r.resource_id) ?? []
          );
          if (rem <= 0) {
            reasons.add("room_capacity_full");
            return false;
          }
          return true;
        });
        if (rooms.length === 0) continue;
        // Prefer keeping couple/multi-guest in same shared cap>=2 room if already used
        if (req.group_room_policy !== "separate_ok") {
          rooms.sort((ra, rb) => {
            const raUsed = (roomChosenWindows.get(ra.resource_id)?.length ?? 0) > 0 && ra.capacity >= 2 ? 0 : 1;
            const rbUsed = (roomChosenWindows.get(rb.resource_id)?.length ?? 0) > 0 && rb.capacity >= 2 ? 0 : 1;
            return raUsed - rbUsed || ra.sort_order - rb.sort_order;
          });
        }
        candidateRooms = rooms;
      }

      for (const room of candidateRooms) {
        staffChosenWindows.set(therapist.staff_id, [
          ...prevWins,
          { start: lw.startMinute, end: lw.endMinute },
        ]);
        staffAddedCount.set(therapist.staff_id, addedCount + 1);
        staffAddedMins.set(
          therapist.staff_id,
          addedMins + (lw.endMinute - lw.startMinute)
        );
        if (room) {
          const prevR = roomChosenWindows.get(room.resource_id) ?? [];
          roomChosenWindows.set(room.resource_id, [
            ...prevR,
            {
              start: lw.startMinute,
              end: lw.endMinute,
              reset: room.reset_buffer_minutes ?? req.room_reset_buffer_minutes,
            },
          ]);
        }

        assignments.push({
          line_id: lw.line.line_id,
          attendee_id: lw.line.attendee_id,
          service_id: lw.line.service_id,
          start_minute: lw.startMinute,
          end_minute: lw.endMinute,
          staff_id: therapist.staff_id,
          staff_name: therapist.name,
          resource_id: room?.resource_id ?? null,
          resource_name: room?.name ?? null,
          matched_preferred_staff: lw.line.preferred_staff_id === therapist.staff_id,
        });

        if (backtrack(idx + 1)) return true;

        assignments.pop();
        staffChosenWindows.set(therapist.staff_id, prevWins);
        staffAddedCount.set(therapist.staff_id, addedCount);
        staffAddedMins.set(therapist.staff_id, addedMins);
        if (room) {
          const prevR = roomChosenWindows.get(room.resource_id) ?? [];
          roomChosenWindows.set(room.resource_id, prevR.slice(0, -1));
        }
      }
    }

    if (!anyT && reasons.size === 0) reasons.add("no_qualified_therapist");
    return false;
  }

  const ok = backtrack(0);
  const firstLw = windows[0]!;
  const eligibleFirstStaffIds = req.therapists
    .filter((t) => checkTherapistEligibility(t, req.branch_id, firstLw, 0, 0).ok)
    .map((t) => t.staff_id);

  return {
    feasible: ok,
    assignments: ok ? assignments : [],
    reasons: ok ? [] : Array.from(reasons).sort(),
    eligibleFirstStaffIds,
    roomMode,
  };
}

export function solveOnsiteFallback(req: OnsiteSolveRequest): OnsiteSolveResponse {
  const t0 = performance.now();
  const probe = buildLineWindows(req.requirements, 0);
  const maxSpan = Math.max(...probe.map((w) => w.endMinute), 60);

  const grid =
    req.candidate_start_minutes.length > 0
      ? [...new Set(req.candidate_start_minutes)].sort((a, b) => a - b)
      : (() => {
          const out: number[] = [];
          for (
            let m = req.branch_open_minute;
            m + maxSpan <= req.branch_close_minute;
            m += req.slot_interval_minutes
          ) {
            out.push(m);
          }
          return out;
        })();

  if (req.mode === "slot_matrix") {
    const activeResources = req.resources.filter((r) => r.is_active);
    const totalCap = activeResources.reduce((acc, r) => acc + r.capacity, 0);
    let roomMode: OnsiteSolveResponse["room_constraint_mode"] = "enforced";
    const candidateSlots: OnsiteSlotAvailability[] = grid.map((slotMin) => {
      const r = solveFixedStartFallback(req, slotMin);
      roomMode = r.roomMode;
      const availCap =
        r.roomMode === "enforced"
          ? activeResources.reduce(
              (acc, res) =>
                acc +
                (res.active_turnover_until_minute !== null &&
                overlaps(
                  slotMin,
                  slotMin + maxSpan,
                  res.turnover_start_minute ?? 0,
                  res.active_turnover_until_minute
                )
                  ? 0
                  : getRemainingRoomCapacity(
                      res,
                      slotMin,
                      slotMin + maxSpan,
                      req.room_reset_buffer_minutes
                    )),
              0
            )
          : totalCap;
      return {
        start_minute: slotMin,
        available: r.feasible,
        eligible_staff_ids: r.eligibleFirstStaffIds,
        available_room_count: availCap,
        total_active_room_capacity: totalCap,
        blocking_reasons: r.reasons,
        sample_assignments: r.assignments,
      };
    });

    const firstOk = candidateSlots.find((s) => s.available);
    return {
      feasible: Boolean(firstOk),
      room_constraint_mode: roomMode,
      requested_start_minute: null,
      assignments: firstOk?.sample_assignments ?? [],
      total_start_minute: firstOk?.start_minute ?? null,
      total_end_minute:
        firstOk && firstOk.sample_assignments.length > 0
          ? Math.max(...firstOk.sample_assignments.map((a) => a.end_minute))
          : null,
      infeasibility_reasons: firstOk ? [] : ["no_feasible_slots_in_requested_window"],
      alternatives: [],
      candidate_slots: candidateSlots,
      solver_latency_ms: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  const reqStart = req.requested_start_minute ?? req.branch_open_minute;
  const primary = solveFixedStartFallback(req, reqStart);
  const alternatives: OnsiteAlternativeSuggestion[] = [];

  if ((req.allow_alternative_times || req.allow_earlier_opportunities) && req.max_alternatives > 0) {
    const ordered = grid
      .filter((m) => m !== reqStart)
      .sort((a, b) => {
        const aPrior = a < reqStart ? 0 : 1;
        const bPrior = b < reqStart ? 0 : 1;
        return aPrior - bPrior || Math.abs(a - reqStart) - Math.abs(b - reqStart);
      });

    for (const cand of ordered) {
      if (alternatives.length >= req.max_alternatives) break;
      if (primary.feasible && (!req.allow_earlier_opportunities || cand > reqStart)) continue;
      const candRes = solveFixedStartFallback(req, cand);
      if (!candRes.feasible || candRes.assignments.length === 0) continue;
      const candEnd = Math.max(...candRes.assignments.map((a) => a.end_minute));
      const names = [...new Set(candRes.assignments.map((a) => a.staff_name))].join(", ");
      alternatives.push({
        kind: cand < reqStart ? "earlier_slot" : "nearby_slot",
        start_minute: cand,
        end_minute: candEnd,
        delta_minutes: cand - reqStart,
        summary: `${cand < reqStart ? "Earlier" : "Alternative"} feasible slot at ${fmtMinute(cand)}–${fmtMinute(candEnd)} with ${names}`,
        assignments: candRes.assignments,
      });
    }
  }

  return {
    feasible: primary.feasible,
    room_constraint_mode: primary.roomMode,
    requested_start_minute: reqStart,
    assignments: primary.assignments,
    total_start_minute:
      primary.assignments.length > 0
        ? Math.min(...primary.assignments.map((a) => a.start_minute))
        : null,
    total_end_minute:
      primary.assignments.length > 0
        ? Math.max(...primary.assignments.map((a) => a.end_minute))
        : null,
    infeasibility_reasons: primary.reasons,
    alternatives,
    candidate_slots: [],
    solver_latency_ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

function getProjectedBookingEnd(b: UnifiedBookingInput, nowMinute: number): number {
  if (b.projected_end_minute !== null) {
    return Math.max(b.end_minute, b.projected_end_minute);
  }
  const running =
    b.status === "in_progress" ||
    b.booking_progress_status === "service_started" ||
    b.tracking_status === "service_started";
  const due = b.session_due_minute ?? b.end_minute;
  if (running && nowMinute > due) return nowMinute + 5;
  return Math.max(b.end_minute, due);
}

export function evaluateUnifiedOperationsFallback(
  req: UnifiedEvaluateRequest
): UnifiedEvaluateResponse {
  const t0 = performance.now();
  const activeBookings = req.bookings.filter(
    (b) => !["cancelled", "rejected", "no_show", "completed"].includes(b.status)
  );
  const configuredRule = Math.max(
    req.rules.travel_buffer_minutes,
    req.rules.scheduling_home_buffer_minutes ?? req.rules.travel_buffer_minutes
  );

  const dynamicBuffers: DynamicBufferDetail[] = [];
  const bufferById = new Map<string, DynamicBufferDetail>();
  for (const b of activeBookings) {
    const res = computeDynamicTransitionBuffer({
      deliveryType: b.delivery_type,
      bookingStartTime: fmtMinute(b.start_minute),
      bookingEndTime: fmtMinute(b.end_minute),
      bufferBeforeMinutes: b.buffer_before_minutes,
      bufferAfterMinutes: b.buffer_after_minutes,
      branchTravelBufferMinutes: req.rules.travel_buffer_minutes,
      schedulingHomeBufferMinutes: req.rules.scheduling_home_buffer_minutes,
      bookingTravelBufferMinutes: b.travel_buffer_minutes,
      liveEtaMinutes: b.live_eta_minutes,
      distanceKm: b.distance_km,
      collectionDecision: b.collection_decision,
    });
    const detail: DynamicBufferDetail = {
      booking_id: b.booking_id,
      pre_buffer_minutes: res.preBufferMinutes,
      post_buffer_minutes: res.postBufferMinutes,
      buffer_source: res.bufferSource,
      configured_rule_buffer_minutes: res.configuredRuleBufferMinutes,
      note: res.note,
    };
    dynamicBuffers.push(detail);
    bufferById.set(b.booking_id, detail);
  }

  const turnoverReady = new Map<string, number>();
  for (const task of req.room_turnovers) {
    if (task.status === "open" || task.status === "in_progress") {
      // Never block scheduling past expected_ready_minute; flag overdue turnover as a non-blocking anomaly instead
      if (task.expected_ready_minute > req.now_minute) {
        turnoverReady.set(
          task.resource_id,
          Math.max(turnoverReady.get(task.resource_id) ?? 0, task.expected_ready_minute)
        );
      } else {
        const overdueMins = Math.max(1, req.now_minute - task.expected_ready_minute);
        pushConflict({
          issue_type: "room_turnover_collision",
          branch_id: req.branch_id,
          affected_booking_ids: [],
          affected_staff_ids: [],
          affected_resource_ids: [task.resource_id],
          severity: "warning",
          confidence_or_data_quality: {
            status: "high",
            score: 0.9,
            notes: ["Room turnover task remained open past expected reset window."],
          },
          predicted_impact: `${task.resource_name} turnover is still open (${overdueMins}m overdue — Utility may have forgotten to click Finish). Room remains open for scheduling; verify readiness.`,
          latest_useful_action_time: fmtMinute(req.now_minute),
          latest_useful_action_minute: req.now_minute,
          recommended_actions: [
            {
              action_id: `clear-stale-turnover:${task.task_id}`,
              action_type: "prioritize_room_turnover",
              label: `Verify & clear ${task.resource_name} turnover`,
              detail: "Confirm room is clean and close the lingering utility turnover task.",
              target_booking_id: null,
              proposed_staff_id: null,
              proposed_staff_name: null,
              proposed_resource_id: task.resource_id,
              proposed_resource_name: task.resource_name,
              proposed_driver_id: null,
              proposed_driver_name: null,
              proposed_start_minute: null,
              proposed_end_minute: null,
              requires_confirmation: false,
            },
          ],
          dedupe_key: `uoe:${req.branch_id}:stale_turnover:${task.resource_id}`,
          source_snapshot_version: req.source_snapshot_version,
        });
      }
    }
  }

  const therapistSpans = new Map<
    string,
    UnifiedEvaluateResponse["therapist_timelines"][number]["spans"]
  >();
  const driverSpans = new Map<
    string,
    Array<{ bookingId: string; start: number; end: number }>
  >();
  const roomBusy = new Map<
    string,
    Array<{ bookingId: string; start: number; end: number; reset: number }>
  >();

  for (const b of activeBookings) {
    const buf = bufferById.get(b.booking_id)!;
    const endCore = getProjectedBookingEnd(b, req.now_minute);
    const effStart = Math.max(0, b.start_minute - buf.pre_buffer_minutes);
    const effEnd = endCore + buf.post_buffer_minutes;
    const isActive =
      b.status === "in_progress" ||
      b.booking_progress_status === "service_started" ||
      b.tracking_status === "service_started";

    if (b.therapist_id) {
      const list = therapistSpans.get(b.therapist_id) ?? [];
      list.push({
        booking_id: b.booking_id,
        delivery_type: b.delivery_type,
        customer_name: b.customer_name,
        service_name: b.service_name,
        start_minute: b.start_minute,
        end_minute: endCore,
        effective_start_minute: effStart,
        effective_end_minute: effEnd,
        resource_id: b.resource_id,
        driver_id: b.driver_id,
        is_active_session: isActive,
      });
      therapistSpans.set(b.therapist_id, list);
    }
    if (b.driver_id && b.delivery_type === "home_service") {
      const dl = driverSpans.get(b.driver_id) ?? [];
      dl.push({ bookingId: b.booking_id, start: effStart, end: effEnd });
      driverSpans.set(b.driver_id, dl);
    }
    if (b.resource_id && b.delivery_type === "in_spa") {
      const rl = roomBusy.get(b.resource_id) ?? [];
      rl.push({
        bookingId: b.booking_id,
        start: b.start_minute,
        end: endCore,
        reset: req.rules.room_reset_buffer_minutes,
      });
      roomBusy.set(b.resource_id, rl);
    }
  }

  for (const list of therapistSpans.values()) {
    list.sort((a, b) => a.start_minute - b.start_minute || a.booking_id.localeCompare(b.booking_id));
  }

  const bookingMap = new Map(activeBookings.map((b) => [b.booking_id, b]));
  const therapistMap = new Map(req.therapists.map((t) => [t.staff_id, t]));
  const resourceMap = new Map(req.resources.map((r) => [r.resource_id, r]));

  const conflicts: PredictiveConflictItem[] = [];
  const seenKeys = new Set<string>();
  const pushConflict = (c: PredictiveConflictItem) => {
    if (!seenKeys.has(c.dedupe_key)) {
      seenKeys.add(c.dedupe_key);
      conflicts.push(c);
    }
  };

  const findReplacementTherapist = (
    b: UnifiedBookingInput,
    tStart: number,
    tEnd: number,
    excludeCurrent = true
  ): { therapist: OnsiteTherapistInput; resource: OnsiteResourceInput | null } | null => {
    const blockedCurrentRoom =
      Boolean(b.resource_id) &&
      tStart === b.start_minute &&
      (turnoverReady.get(b.resource_id!) ?? 0) > tStart;
    for (const therapist of [...req.therapists].sort(
      (a, c) =>
        (a.staff_id === b.therapist_id ? 0 : 1) - (c.staff_id === b.therapist_id ? 0 : 1) ||
        (a.checked_in ? 0 : 1) - (c.checked_in ? 0 : 1) ||
        a.completed_count_today - c.completed_count_today
    )) {
      if (excludeCurrent && therapist.staff_id === b.therapist_id) continue;
      const busyWins = (therapistSpans.get(therapist.staff_id) ?? [])
        .filter((s) => s.booking_id !== b.booking_id)
        .map((s) => ({
          booking_id: s.booking_id,
          start_minute: s.start_minute,
          end_minute: s.end_minute,
          effective_start_minute: s.effective_start_minute,
          effective_end_minute: s.effective_end_minute,
          delivery_type: s.delivery_type,
          resource_id: s.resource_id,
          is_active_session: s.is_active_session,
        }));
      const probeRes: OnsiteResourceInput[] =
        b.delivery_type === "in_spa"
          ? req.resources.map((r) => ({
              ...r,
              active_turnover_until_minute: Math.max(
                r.active_turnover_until_minute ?? 0,
                turnoverReady.get(r.resource_id) ?? 0
              ) || null,
              busy_windows: (roomBusy.get(r.resource_id) ?? [])
                .filter((bw) => bw.bookingId !== b.booking_id)
                .map((bw) => ({
                  booking_id: bw.bookingId,
                  start_minute: bw.start,
                  end_minute: bw.end,
                  reset_after_minutes: bw.reset,
                })),
            }))
          : [];
      const res = solveOnsiteFallback({
        branch_id: req.branch_id,
        date: req.date,
        branch_open_minute: Math.min(req.rules.in_spa_open_minute, tStart),
        branch_close_minute: Math.max(req.rules.in_spa_close_minute, tEnd + 30),
        slot_interval_minutes: 30,
        room_reset_buffer_minutes: req.rules.room_reset_buffer_minutes,
        mode: "assign_order",
        requested_start_minute: tStart,
        candidate_start_minutes: [],
        allow_alternative_times: false,
        allow_earlier_opportunities: false,
        max_alternatives: 0,
        enforce_room_capacity: b.delivery_type === "in_spa" && probeRes.length > 0,
        group_room_policy: "prefer_together",
        therapists: [{ ...therapist, busy_windows: busyWins }],
        resources: probeRes,
        requirements: [
          {
            line_id: b.booking_id,
            attendee_id: "att-1",
            line_index: 0,
            service_id: b.service_id,
            service_name: b.service_name,
            duration_minutes: Math.max(15, tEnd - tStart),
            buffer_before_minutes: b.buffer_before_minutes,
            buffer_after_minutes: b.buffer_after_minutes,
            requires_room: b.delivery_type === "in_spa" && b.requires_room,
            preferred_staff_id: null,
            locked_staff_id: therapist.staff_id,
            locked_resource_id:
              tStart === b.start_minute && !blockedCurrentRoom ? b.resource_id : null,
            allowed_resource_types: [],
          },
        ],
      });
      if (res.feasible && res.assignments[0]) {
        const chosenRes =
          req.resources.find((r) => r.resource_id === res.assignments[0]!.resource_id) ??
          null;
        return { therapist, resource: chosenRes };
      }
    }
    return null;
  };

  // 1, 2, 6: Cross-mode & active overrun collisions
  for (const [tid, spans] of therapistSpans.entries()) {
    const therapist = therapistMap.get(tid);
    const tName = therapist?.name ?? "Therapist";
    for (let i = 0; i < spans.length - 1; i++) {
      const curr = spans[i]!;
      const nxt = spans[i + 1]!;
      const currBuf = bufferById.get(curr.booking_id)!;
      const nxtBuf = bufferById.get(nxt.booking_id)!;
      const neededEnd = curr.end_minute + currBuf.post_buffer_minutes;
      const nxtEffStart = nxt.start_minute - nxtBuf.pre_buffer_minutes;
      if (neededEnd <= nxtEffStart) continue;

      const overlapMins = neededEnd - nxtEffStart;
      const issueType: PredictiveConflictItem["issue_type"] =
        curr.delivery_type === "home_service" && nxt.delivery_type === "in_spa"
          ? "home_service_to_onsite_collision"
          : curr.delivery_type === "in_spa" && nxt.delivery_type === "home_service"
            ? "onsite_to_home_service_collision"
            : "session_overrun_ripple";

      const nxtBooking = bookingMap.get(nxt.booking_id)!;
      const rep = findReplacementTherapist(nxtBooking, nxt.start_minute, nxt.end_minute, true);
      const custSel = nxtBooking.therapist_selection_source === "customer_selected";
      const actions: RecommendedStaffAction[] = rep
        ? [
            {
              action_id: `swap-therapist:${nxt.booking_id}:${rep.therapist.staff_id}`,
              action_type: "swap_therapist",
              label: `Move ${nxt.customer_name} (${fmtMinute(nxt.start_minute)}) to ${rep.therapist.name}`,
              detail: `${rep.therapist.name} is verified free & qualified.`,
              target_booking_id: nxt.booking_id,
              proposed_staff_id: rep.therapist.staff_id,
              proposed_staff_name: rep.therapist.name,
              proposed_resource_id: rep.resource?.resource_id ?? nxt.resource_id,
              proposed_resource_name: rep.resource?.name ?? null,
              proposed_driver_id: null,
              proposed_driver_name: null,
              proposed_start_minute: null,
              requires_customer_approval: custSel,
              verified_feasible: true,
            },
          ]
        : [];

      const latestMin = Math.max(req.now_minute, Math.min(curr.end_minute, nxt.start_minute) - 15);
      const sev = overlapMins >= 20 || latestMin - req.now_minute <= 15 ? "critical" : "high";
      pushConflict({
        issue_type: issueType,
        branch_id: req.branch_id,
        affected_booking_ids: [curr.booking_id, nxt.booking_id],
        affected_staff_ids: [tid],
        affected_resource_ids: [curr.resource_id, nxt.resource_id].filter((x): x is string => Boolean(x)),
        severity: sev,
        confidence_or_data_quality: {
          status: currBuf.buffer_source === "live_traffic" ? "high" : "medium",
          score: currBuf.buffer_source === "live_traffic" ? 0.92 : 0.78,
          notes: [currBuf.note, nxtBuf.note],
        },
        predicted_impact: `${tName}'s schedule collides by ${overlapMins}m between ${curr.customer_name} and ${nxt.customer_name}.`,
        latest_useful_action_time: fmtMinute(latestMin),
        latest_useful_action_minute: latestMin,
        recommended_actions: actions,
        authorization_required: custSel ? "customer_confirmation" : "crm_operator",
        source_snapshot_version: req.source_snapshot_version,
        dedupe_key: `uoe:${req.branch_id}:${issueType}:${curr.booking_id}:${nxt.booking_id}`,
        expiration_or_resolution_condition: "Resolves once conflicting booking is reassigned or rescheduled.",
        assistant_tier: "persistent_action_required",
      });
    }

    for (const sp of spans) {
      if (!sp.is_active_session) continue;
      const b = bookingMap.get(sp.booking_id)!;
      const due = b.session_due_minute ?? b.end_minute;
      if (req.now_minute > due) {
        const overrun = req.now_minute - due;
        pushConflict({
          issue_type: "session_overrun_ripple",
          branch_id: req.branch_id,
          affected_booking_ids: [b.booking_id],
          affected_staff_ids: [tid],
          affected_resource_ids: b.resource_id ? [b.resource_id] : [],
          severity: overrun >= 10 ? "high" : "warning",
          confidence_or_data_quality: {
            status: "high",
            score: 0.95,
            notes: [`Active session past due by ${overrun}m.`],
          },
          predicted_impact: `${tName}'s active session for ${b.customer_name} is ${overrun}m past due.`,
          latest_useful_action_time: fmtMinute(req.now_minute),
          latest_useful_action_minute: req.now_minute,
          recommended_actions: [],
          authorization_required: "crm_operator",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:active_overrun:${b.booking_id}`,
          expiration_or_resolution_condition: "Resolves on session completion or extension.",
          assistant_tier: overrun >= 10 ? "persistent_action_required" : "early_warning_toast",
        });
      }
    }
  }

  // 4, 5, 7, 8: Room bottlenecks/turnovers, unassigned staff/drivers, location/GPS
  for (const b of activeBookings) {
    if (b.delivery_type === "in_spa" && b.requires_room && b.resource_id) {
      const turnUntil = turnoverReady.get(b.resource_id);
      const res = resourceMap.get(b.resource_id);
      if (res && turnUntil !== undefined && b.start_minute < turnUntil) {
        const altRoom = req.resources.find(
          (r) =>
            r.is_active &&
            r.resource_id !== b.resource_id &&
            (turnoverReady.get(r.resource_id) ?? 0) <= b.start_minute &&
            getRemainingRoomCapacity(
              {
                ...r,
                busy_windows: (roomBusy.get(r.resource_id) ?? []).map((bw) => ({
                  booking_id: bw.bookingId,
                  start_minute: bw.start,
                  end_minute: bw.end,
                  reset_after_minutes: bw.reset,
                })),
              },
              b.start_minute,
              getProjectedBookingEnd(b, req.now_minute),
              req.rules.room_reset_buffer_minutes
            ) > 0
        );
        pushConflict({
          issue_type: "room_turnover_collision",
          branch_id: req.branch_id,
          affected_booking_ids: [b.booking_id],
          affected_staff_ids: b.therapist_id ? [b.therapist_id] : [],
          affected_resource_ids: [res.resource_id],
          severity: "high",
          confidence_or_data_quality: {
            status: "high",
            score: 0.93,
            notes: ["Active workflow room_turnover overlaps start time."],
          },
          predicted_impact: `${res.name} cleaning runs until ${fmtMinute(turnUntil)}, overlapping ${b.customer_name}.`,
          latest_useful_action_time: fmtMinute(Math.max(req.now_minute, b.start_minute - 5)),
          latest_useful_action_minute: Math.max(req.now_minute, b.start_minute - 5),
          recommended_actions: altRoom
            ? [
                {
                  action_id: `move-room:${b.booking_id}:${altRoom.resource_id}`,
                  action_type: "reassign_room",
                  label: `Move ${b.customer_name} to ${altRoom.name}`,
                  detail: `${altRoom.name} is ready.`,
                  target_booking_id: b.booking_id,
                  proposed_staff_id: null,
                  proposed_staff_name: null,
                  proposed_resource_id: altRoom.resource_id,
                  proposed_resource_name: altRoom.name,
                  proposed_driver_id: null,
                  proposed_driver_name: null,
                  proposed_start_minute: null,
                  requires_customer_approval: false,
                  verified_feasible: true,
                },
              ]
            : [],
          authorization_required: "crm_operator",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:turnover:${res.resource_id}:${b.booking_id}`,
          expiration_or_resolution_condition: "Resolves when room turnover finishes or room moves.",
          assistant_tier: "persistent_action_required",
        });
      }
    }

    const lead = b.start_minute - req.now_minute;
    if (lead >= -30 && lead <= 180) {
      if (!b.therapist_id) {
        const rep = findReplacementTherapist(b, b.start_minute, b.end_minute, true);
        pushConflict({
          issue_type: "therapist_unassigned_risk",
          branch_id: req.branch_id,
          affected_booking_ids: [b.booking_id],
          affected_staff_ids: [],
          affected_resource_ids: b.resource_id ? [b.resource_id] : [],
          severity: lead <= 45 ? "critical" : "high",
          confidence_or_data_quality: {
            status: "high",
            score: 0.98,
            notes: ["Booking lacks therapist inside active horizon."],
          },
          predicted_impact: `${b.customer_name} (${fmtMinute(b.start_minute)}) has no therapist assigned.`,
          latest_useful_action_time: fmtMinute(Math.max(req.now_minute, b.start_minute - 15)),
          latest_useful_action_minute: Math.max(req.now_minute, b.start_minute - 15),
          recommended_actions: rep
            ? [
                {
                  action_id: `assign-therapist:${b.booking_id}:${rep.therapist.staff_id}`,
                  action_type: "assign_therapist",
                  label: `Assign ${rep.therapist.name}`,
                  detail: `${rep.therapist.name} is available at ${fmtMinute(b.start_minute)}.`,
                  target_booking_id: b.booking_id,
                  proposed_staff_id: rep.therapist.staff_id,
                  proposed_staff_name: rep.therapist.name,
                  proposed_resource_id: rep.resource?.resource_id ?? null,
                  proposed_resource_name: rep.resource?.name ?? null,
                  proposed_driver_id: null,
                  proposed_driver_name: null,
                  proposed_start_minute: null,
                  requires_customer_approval: false,
                  verified_feasible: true,
                },
              ]
            : [],
          authorization_required: "crm_operator",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:unassigned_therapist:${b.booking_id}`,
          expiration_or_resolution_condition: "Resolves once therapist is assigned.",
          assistant_tier: "persistent_action_required",
        });
      }
      if (b.delivery_type === "home_service" && !b.driver_id) {
        const freeDriver = req.drivers.find(
          (d) =>
            (d.home_branch_id === req.branch_id || d.allowed_branch_ids.includes(req.branch_id)) &&
            d.shift_windows.some((sw) => b.start_minute >= sw.start_minute && b.end_minute <= sw.end_minute) &&
            !(driverSpans.get(d.driver_id) ?? []).some((sp) =>
              overlaps(b.start_minute - 30, b.end_minute + 15, sp.start, sp.end)
            )
        );
        pushConflict({
          issue_type: "driver_unassigned_risk",
          branch_id: req.branch_id,
          affected_booking_ids: [b.booking_id],
          affected_staff_ids: b.therapist_id ? [b.therapist_id] : [],
          affected_resource_ids: [],
          severity: lead <= 60 ? "critical" : "high",
          confidence_or_data_quality: {
            status: "high",
            score: 0.98,
            notes: ["Home-service dispatch missing driver."],
          },
          predicted_impact: `Home Service ${b.customer_name} (${fmtMinute(b.start_minute)}) needs a driver.`,
          latest_useful_action_time: fmtMinute(Math.max(req.now_minute, b.start_minute - 30)),
          latest_useful_action_minute: Math.max(req.now_minute, b.start_minute - 30),
          recommended_actions: freeDriver
            ? [
                {
                  action_id: `assign-driver:${b.booking_id}:${freeDriver.driver_id}`,
                  action_type: "assign_driver",
                  label: `Assign driver ${freeDriver.name}`,
                  detail: `${freeDriver.name} is free for this window.`,
                  target_booking_id: b.booking_id,
                  proposed_staff_id: null,
                  proposed_staff_name: null,
                  proposed_resource_id: null,
                  proposed_resource_name: null,
                  proposed_driver_id: freeDriver.driver_id,
                  proposed_driver_name: freeDriver.name,
                  proposed_start_minute: null,
                  requires_customer_approval: false,
                  verified_feasible: true,
                },
              ]
            : [],
          authorization_required: "crm_operator",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:unassigned_driver:${b.booking_id}`,
          expiration_or_resolution_condition: "Resolves once driver is assigned.",
          assistant_tier: "persistent_action_required",
        });
      }
    }

    if (b.delivery_type === "home_service" && !b.has_valid_customer_location) {
      pushConflict({
        issue_type: "location_or_gps_degraded",
        branch_id: req.branch_id,
        affected_booking_ids: [b.booking_id],
        affected_staff_ids: [b.therapist_id, b.driver_id].filter((x): x is string => Boolean(x)),
        affected_resource_ids: [],
        severity: "high",
        confidence_or_data_quality: {
          status: "degraded_gps",
          score: 0.45,
          notes: ["Customer location coordinates missing."],
        },
        predicted_impact: `Home Service ${b.customer_name} lacks verified map coordinates.`,
        latest_useful_action_time: fmtMinute(Math.max(req.now_minute, b.start_minute - 45)),
        latest_useful_action_minute: Math.max(req.now_minute, b.start_minute - 45),
        recommended_actions: [],
        authorization_required: "crm_operator",
        source_snapshot_version: req.source_snapshot_version,
        dedupe_key: `uoe:${req.branch_id}:missing_loc:${b.booking_id}`,
        expiration_or_resolution_condition: "Resolves when customer address pin is verified.",
        assistant_tier: "persistent_action_required",
      });
    }
  }

  // Room capacity bottleneck (3/4): check if concurrent bookings in any room exceed capacity
  for (const res of req.resources) {
    const busy = roomBusy.get(res.resource_id) ?? [];
    if (busy.length <= res.capacity) continue;
    for (const bw of busy) {
      const concurrent = busy.filter(
        (other) =>
          other.bookingId !== bw.bookingId &&
          overlaps(bw.start, bw.end + bw.reset, other.start, other.end + other.reset)
      );
      if (concurrent.length + 1 > res.capacity) {
        const b = bookingMap.get(bw.bookingId);
        pushConflict({
          issue_type: "room_capacity_bottleneck",
          branch_id: req.branch_id,
          affected_booking_ids: [bw.bookingId, ...concurrent.map((c) => c.bookingId)],
          affected_staff_ids: b?.therapist_id ? [b.therapist_id] : [],
          affected_resource_ids: [res.resource_id],
          severity: "high",
          confidence_or_data_quality: { status: "high", score: 0.9, notes: [] },
          predicted_impact: `${res.name} has ${concurrent.length + 1} overlapping appointments against capacity ${res.capacity}.`,
          latest_useful_action_time: fmtMinute(Math.max(req.now_minute, bw.start - 20)),
          latest_useful_action_minute: Math.max(req.now_minute, bw.start - 20),
          recommended_actions: [],
          authorization_required: "crm_operator",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:room_cap:${res.resource_id}:${bw.bookingId}`,
          expiration_or_resolution_condition: "Resolves once one booking is moved to another room or slot.",
          assistant_tier: "persistent_action_required",
        });
        break;
      }
    }
  }

  // Driver GPS degraded / offline (8b)
  for (const drv of req.drivers) {
    const hasHomeAssignment = activeBookings.some(
      (b) => b.delivery_type === "home_service" && b.driver_id === drv.driver_id && b.start_minute >= req.now_minute - 30
    );
    if (!hasHomeAssignment) continue;
    const staleGps = drv.gps_age_seconds !== null && drv.gps_age_seconds > 900;
    const lowAcc = drv.gps_accuracy_meters !== null && drv.gps_accuracy_meters > 100;
    if (drv.gps_offline || drv.gps_permission_missing || staleGps || lowAcc) {
      pushConflict({
        issue_type: "location_or_gps_degraded",
        branch_id: req.branch_id,
        affected_booking_ids: [],
        affected_staff_ids: [drv.driver_id],
        affected_resource_ids: [],
        severity: "warning",
        confidence_or_data_quality: { status: "degraded_gps", score: 0.5, notes: ["Driver telemetry stale or low accuracy."] },
        predicted_impact: `${drv.name}'s GPS telemetry is stale/degraded while handling active home-service assignments.`,
        latest_useful_action_time: fmtMinute(req.now_minute + 15),
        latest_useful_action_minute: req.now_minute + 15,
        recommended_actions: [],
        authorization_required: "crm_operator",
        source_snapshot_version: req.source_snapshot_version,
        dedupe_key: `uoe:${req.branch_id}:driver_gps:${drv.driver_id}`,
        expiration_or_resolution_condition: "Resolves once fresh accurate driver GPS telemetry resumes.",
        assistant_tier: "early_warning_toast",
      });
    }
  }

  // Cross-branch pending lending overlap (9b)
  for (const ar of req.assistance_requests) {
    if (ar.lending_branch_id !== req.branch_id || ar.status !== "approved_pending_arrival") continue;
    for (const sid of ar.selected_staff_ids) {
      const overlapsHomeBooking = (therapistSpans.get(sid) ?? []).filter((sp) =>
        overlaps(sp.effective_start_minute, sp.effective_end_minute, ar.start_minute, ar.end_minute)
      );
      if (overlapsHomeBooking.length > 0) {
        pushConflict({
          issue_type: "rule_drift_or_cross_branch_gap",
          branch_id: req.branch_id,
          affected_booking_ids: overlapsHomeBooking.map((o) => o.booking_id),
          affected_staff_ids: [sid],
          affected_resource_ids: [],
          severity: "high",
          confidence_or_data_quality: { status: "high", score: 0.9, notes: ["Pending cross-branch transfer overlaps home booking."] },
          predicted_impact: `Provisional cross-branch lending request overlaps ${overlapsHomeBooking.length} booking(s) on the lending branch.`,
          latest_useful_action_time: fmtMinute(Math.max(req.now_minute, ar.start_minute - 30)),
          latest_useful_action_minute: Math.max(req.now_minute, ar.start_minute - 30),
          recommended_actions: [],
          authorization_required: "manager_or_owner",
          source_snapshot_version: req.source_snapshot_version,
          dedupe_key: `uoe:${req.branch_id}:assist_gap:${ar.request_id}:${sid}`,
          expiration_or_resolution_condition: "Resolves when booking is reassigned or transfer window adjusted.",
          assistant_tier: "persistent_action_required",
        });
      }
    }
  }

  // Quiet earlier-slot opportunity (10)
  for (const b of activeBookings) {
    if (b.delivery_type !== "in_spa" || b.status !== "confirmed" || !b.therapist_id) continue;
    if (b.start_minute < req.now_minute + 90) continue;
    const therapist = therapistMap.get(b.therapist_id);
    if (!therapist) continue;
    const probeStart = Math.max(
      req.rules.in_spa_open_minute + b.buffer_before_minutes,
      req.now_minute + 30
    );
    if (probeStart >= b.start_minute - 45) continue;
    const rep = findReplacementTherapist(b, probeStart, probeStart + b.duration_minutes, false);
    if (rep && rep.therapist.staff_id === therapist.staff_id) {
      pushConflict({
        issue_type: "earlier_slot_opportunity",
        branch_id: req.branch_id,
        affected_booking_ids: [b.booking_id],
        affected_staff_ids: [therapist.staff_id],
        affected_resource_ids: rep.resource ? [rep.resource.resource_id] : [],
        severity: "info",
        confidence_or_data_quality: { status: "high", score: 0.88, notes: ["Both therapist and room are free earlier."] },
        predicted_impact: `${b.customer_name} (${fmtMinute(b.start_minute)}) can be served earlier at ${fmtMinute(probeStart)} with ${therapist.name}.`,
        latest_useful_action_time: fmtMinute(Math.max(req.now_minute, probeStart - 15)),
        latest_useful_action_minute: Math.max(req.now_minute, probeStart - 15),
        recommended_actions: [
          {
            action_id: `earlier:${b.booking_id}:${probeStart}`,
            action_type: "offer_earlier_slot",
            label: `Offer ${b.customer_name} earlier ${fmtMinute(probeStart)} slot`,
            detail: `${therapist.name}${rep.resource ? ` in ${rep.resource.name}` : ""} is open earlier.`,
            target_booking_id: b.booking_id,
            proposed_staff_id: therapist.staff_id,
            proposed_staff_name: therapist.name,
            proposed_resource_id: rep.resource?.resource_id ?? null,
            proposed_resource_name: rep.resource?.name ?? null,
            proposed_driver_id: null,
            proposed_driver_name: null,
            proposed_start_minute: probeStart,
            requires_customer_approval: true,
            verified_feasible: true,
          },
        ],
        authorization_required: "customer_confirmation",
        source_snapshot_version: req.source_snapshot_version,
        dedupe_key: `uoe:${req.branch_id}:earlier:${b.booking_id}`,
        expiration_or_resolution_condition: "Quiet opportunity; expires once probe window passes.",
        assistant_tier: "quiet_opportunity",
      });
      break;
    }
  }

  // Rule drift
  if (
    req.rules.scheduling_home_buffer_minutes !== null &&
    req.rules.scheduling_home_buffer_minutes !== req.rules.travel_buffer_minutes
  ) {
    pushConflict({
      issue_type: "rule_drift_or_cross_branch_gap",
      branch_id: req.branch_id,
      affected_booking_ids: [],
      affected_staff_ids: [],
      affected_resource_ids: [],
      severity: "warning",
      confidence_or_data_quality: {
        status: "rule_fallback",
        score: 0.9,
        notes: [
          `travel_buffer_minutes=${req.rules.travel_buffer_minutes} vs scheduling_home_buffer_minutes=${req.rules.scheduling_home_buffer_minutes}`,
        ],
      },
      predicted_impact: `${req.branch_name} booking & scheduling travel buffers differ; using ${configuredRule}m safe maximum.`,
      latest_useful_action_time: fmtMinute(req.now_minute + 60),
      latest_useful_action_minute: req.now_minute + 60,
      recommended_actions: [],
      authorization_required: "manager_or_owner",
      source_snapshot_version: req.source_snapshot_version,
      dedupe_key: `uoe:${req.branch_id}:rule_drift`,
      expiration_or_resolution_condition: "Resolves once branch rules match.",
      assistant_tier: "early_warning_toast",
    });
  }

  const timelineSummaries = req.therapists.map((t) => {
    const spans = therapistSpans.get(t.staff_id) ?? [];
    return {
      staff_id: t.staff_id,
      staff_name: t.name,
      home_branch_id: t.home_branch_id,
      checked_in: t.checked_in,
      scheduled_minutes_today: t.shift_windows.reduce(
        (acc, w) => acc + (w.end_minute - w.start_minute),
        0
      ),
      booked_minutes_today: spans.reduce((acc, s) => acc + (s.end_minute - s.start_minute), 0),
      spans,
    };
  });

  const sevOrder = { critical: 0, high: 1, warning: 2, info: 3 };
  conflicts.sort(
    (a, b) =>
      sevOrder[a.severity] - sevOrder[b.severity] ||
      a.latest_useful_action_minute - b.latest_useful_action_minute
  );

  return {
    branch_id: req.branch_id,
    date: req.date,
    now_minute: req.now_minute,
    source_snapshot_version: req.source_snapshot_version,
    dynamic_buffers: dynamicBuffers,
    therapist_timelines: timelineSummaries,
    conflicts_and_opportunities: conflicts,
    summary_counts: {
      critical: conflicts.filter((c) => c.severity === "critical").length,
      high: conflicts.filter((c) => c.severity === "high").length,
      warning: conflicts.filter((c) => c.severity === "warning").length,
      info: conflicts.filter((c) => c.severity === "info").length,
      persistent_action_required: conflicts.filter(
        (c) => c.assistant_tier === "persistent_action_required"
      ).length,
      early_warning_toast: conflicts.filter(
        (c) => c.assistant_tier === "early_warning_toast"
      ).length,
      quiet_opportunity: conflicts.filter(
        (c) => c.assistant_tier === "quiet_opportunity"
      ).length,
    },
    evaluator_latency_ms: Math.round((performance.now() - t0) * 100) / 100,
  };
}

