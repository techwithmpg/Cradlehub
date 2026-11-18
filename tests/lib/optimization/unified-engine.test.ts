import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildBookingUpdatesFromOptimizerResponse, type OptimizerRequestPayload, type OptimizerResponsePayload } from "@/lib/dispatch/optimizer-bridge";
import { computeDynamicTransitionBuffer } from "@/lib/optimization/dynamic-buffer";
import {
  evaluateUnifiedOperationsFallback,
  solveOnsiteFallback,
} from "@/lib/optimization/fallback-evaluator";
import { filterSlotsByRoomAndHomeTravel } from "@/lib/optimization/onsite-availability-adapter";
import { fakeDatabase } from "../../helpers/stage08a-db";

describe("Unified Optimization Engine TypeScript Layer", () => {
  it("computes conservative dynamic buffers with live ETA vs distance fallback and cross-midnight wrap", () => {
    const livePeak = computeDynamicTransitionBuffer({
      deliveryType: "home_service",
      bookingStartTime: "17:30",
      bookingEndTime: "18:30",
      branchTravelBufferMinutes: 30,
      liveEtaMinutes: 28,
      collectionDecision: "required",
    });
    expect(livePeak.bufferSource).toBe("live_traffic");
    expect(livePeak.preBufferMinutes).toBeGreaterThanOrEqual(45);
    expect(livePeak.effectiveStartMinute).toBe(1050 - livePeak.preBufferMinutes);

    const dist = computeDynamicTransitionBuffer({
      deliveryType: "home_service",
      bookingStartTime: "23:30",
      bookingEndTime: "00:30",
      branchTravelBufferMinutes: 30,
      schedulingHomeBufferMinutes: 60,
      distanceKm: 5,
      collectionDecision: "not_required",
    });
    expect(dist.bufferSource).toBe("distance_fallback");
    expect(dist.effectiveEndMinute).toBeGreaterThan(24 * 60);
    expect(dist.postBufferMinutes).toBe(5);
  });

  it("enforces room capacity, active turnover, home-service buffer, and cross-branch assistance in onsite fallback", () => {
    const res = solveOnsiteFallback({
      branch_id: "sm-branch",
      date: "2026-11-18",
      branch_open_minute: 600,
      branch_close_minute: 1200,
      slot_interval_minutes: 30,
      room_reset_buffer_minutes: 10,
      mode: "assign_order",
      requested_start_minute: 720,
      candidate_start_minutes: [],
      allow_alternative_times: true,
      allow_earlier_opportunities: true,
      max_alternatives: 3,
      enforce_room_capacity: true,
      group_room_policy: "prefer_together",
      therapists: [
        {
          staff_id: "t-lending",
          name: "Lending Therapist",
          home_branch_id: "main-spa",
          seniority_rank: 1,
          completed_count_today: 0,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1200 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [
            {
              requesting_branch_id: "sm-branch",
              start_minute: 660,
              end_minute: 900,
              visit_type: "in_spa",
            },
          ],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 0,
          existing_working_minutes_today: 0,
        },
        {
          staff_id: "t-local",
          name: "Local Therapist",
          home_branch_id: "sm-branch",
          seniority_rank: 2,
          completed_count_today: 1,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1200 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 0,
          existing_working_minutes_today: 0,
        },
      ],
      resources: [
        {
          resource_id: "r-dirty",
          name: "Room 5, bed 1",
          resource_type: "room",
          capacity: 1,
          sort_order: 1,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: 740,
          turnover_start_minute: 710,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
        {
          resource_id: "r-couples",
          name: "Room 1",
          resource_type: "room",
          capacity: 2,
          sort_order: 2,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: null,
          turnover_start_minute: null,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
      ],
      requirements: [
        {
          line_id: "g1",
          attendee_id: "att-1",
          line_index: 0,
          service_id: "svc-1",
          service_name: "Hilot",
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          requires_room: true,
          preferred_staff_id: null,
          locked_staff_id: null,
          locked_resource_id: null,
          allowed_resource_types: [],
        },
        {
          line_id: "g2",
          attendee_id: "att-2",
          line_index: 0,
          service_id: "svc-1",
          service_name: "Hilot",
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          requires_room: true,
          preferred_staff_id: null,
          locked_staff_id: null,
          locked_resource_id: null,
          allowed_resource_types: [],
        },
      ],
    });

    expect(res.feasible).toBe(true);
    expect(res.room_constraint_mode).toBe("enforced");
    expect(new Set(res.assignments.map((a) => a.staff_id)).size).toBe(2);
    expect(new Set(res.assignments.map((a) => a.resource_id))).toEqual(new Set(["r-couples"]));
  });

  it("evaluates cross-mode collisions and recommends verified feasible replacement", () => {
    const evalRes = evaluateUnifiedOperationsFallback({
      branch_id: "main-spa",
      branch_name: "Main Spa",
      date: "2026-11-18",
      now_minute: 700,
      source_snapshot_version: "snap-1",
      rules: {
        travel_buffer_minutes: 30,
        scheduling_home_buffer_minutes: 60,
        room_reset_buffer_minutes: 10,
        in_spa_open_minute: 600,
        in_spa_close_minute: 1350,
        home_open_minute: 870,
        home_close_minute: 1320,
        min_daily_therapists: 1,
      },
      therapists: [
        {
          staff_id: "t1",
          name: "Therapist 1",
          home_branch_id: "main-spa",
          seniority_rank: 1,
          completed_count_today: 1,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1320 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 0,
          existing_working_minutes_today: 0,
        },
        {
          staff_id: "t2",
          name: "Therapist Backup",
          home_branch_id: "main-spa",
          seniority_rank: 2,
          completed_count_today: 0,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1320 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 0,
          existing_working_minutes_today: 0,
        },
      ],
      drivers: [],
      resources: [
        {
          resource_id: "r1",
          name: "Room 1",
          resource_type: "room",
          capacity: 2,
          sort_order: 1,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: null,
          turnover_start_minute: null,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
      ],
      bookings: [
        {
          booking_id: "b-hs",
          order_id: null,
          customer_name: "Home Guest",
          service_id: "svc-1",
          service_name: "Massage",
          delivery_type: "home_service",
          status: "in_progress",
          booking_progress_status: "arrived",
          tracking_status: "arrived_at_customer",
          therapist_id: "t1",
          therapist_selection_source: null,
          driver_id: "d1",
          collection_driver_id: null,
          resource_id: null,
          start_minute: 660,
          end_minute: 720,
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          travel_buffer_minutes: 30,
          live_eta_minutes: 20,
          distance_km: 4,
          session_started_minute: 660,
          session_due_minute: 720,
          projected_end_minute: 720,
          collection_decision: "required",
          has_valid_customer_location: true,
          requires_room: false,
        },
        {
          booking_id: "b-in",
          order_id: null,
          customer_name: "In-Spa Guest",
          service_id: "svc-1",
          service_name: "Massage",
          delivery_type: "in_spa",
          status: "confirmed",
          booking_progress_status: "not_started",
          tracking_status: null,
          therapist_id: "t1",
          therapist_selection_source: "auto_assigned",
          driver_id: null,
          collection_driver_id: null,
          resource_id: "r1",
          start_minute: 730,
          end_minute: 790,
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          travel_buffer_minutes: null,
          live_eta_minutes: null,
          distance_km: null,
          session_started_minute: null,
          session_due_minute: null,
          projected_end_minute: null,
          collection_decision: null,
          has_valid_customer_location: true,
          requires_room: true,
        },
      ],
      room_turnovers: [],
      assistance_requests: [],
    });

    const hsCollision = evalRes.conflicts_and_opportunities.find(
      (c) => c.issue_type === "home_service_to_onsite_collision"
    );
    expect(hsCollision).toBeDefined();
    expect(hsCollision!.recommended_actions[0]?.proposed_staff_id).toBe("t2");
    expect(hsCollision!.recommended_actions[0]?.verified_feasible).toBe(true);
    expect(
      evalRes.conflicts_and_opportunities.some((c) => c.issue_type === "rule_drift_or_cross_branch_gap")
    ).toBe(true);
  });

  it("filters slots by active room capacity & home-service dynamic travel windows cleanly", async () => {
    const db = fakeDatabase({
      branch_resources: [{ id: "r1", branch_id: "b1", is_active: true, capacity: 1 }],
      bookings: [
        {
          id: "bk-room",
          branch_id: "b1",
          booking_date: "2026-11-20",
          staff_id: "t-other",
          resource_id: "r1",
          start_time: "14:00:00",
          end_time: "15:00:00",
          status: "confirmed",
          hold_expires_at: null,
          delivery_type: "in_spa",
          travel_buffer_mins: null,
          session_due_at: null,
          metadata: {},
        },
        {
          id: "bk-hs",
          branch_id: "b1",
          booking_date: "2026-11-20",
          staff_id: "t1",
          resource_id: null,
          start_time: "12:00:00",
          end_time: "13:00:00",
          status: "confirmed",
          hold_expires_at: null,
          delivery_type: "home_service",
          travel_buffer_mins: 30,
          session_due_at: null,
          metadata: {},
        },
      ],
      branch_booking_rules: [{ branch_id: "b1", travel_buffer_mins: 30 }],
      scheduling_rules: [],
      workflow_tasks: [],
    });

    const filtered = await filterSlotsByRoomAndHomeTravel({
      supabase: db.client as never,
      branchId: "b1",
      date: "2026-11-20",
      deliveryMode: "in_spa",
      blockMinutes: 60,
      slots: [
        { staff_id: "t1", slot_time: "10:00:00", available: true },
        { staff_id: "t1", slot_time: "13:00:00", available: true }, // Hits t1 post-HS return buffer
        { staff_id: "t1", slot_time: "14:00:00", available: true }, // Hits r1 full cap=1
      ],
    });

    expect(filtered[0]!.available).toBe(true);
    expect(filtered[1]!.available).toBe(false);
    expect(filtered[2]!.available).toBe(false);
  });

  it("segments distinct morning & afternoon tours of one driver into separate vehicleJourneyIds", () => {
    const req = {
      snapshot_id: "snap-tour-test",
      planning_date: "2026-11-18",
      timezone: "Asia/Manila",
      horizon_end_minute: 1440,
      drivers: [],
      therapists: [
        {
          therapist_id: "t1",
          name: "T1",
          booking_id: "b-morning",
          branch_id: "b1",
          pickup_location_id: "branch:b1",
          customer_location_id: "customer:b-morning",
          required_arrival_minute: 600,
          estimated_service_end_minute: 660,
          permitted_return_location_id: "branch:b1",
          passenger_seats: 1,
          is_final_appointment: false,
        },
        {
          therapist_id: "t2",
          name: "T2",
          booking_id: "b-afternoon",
          branch_id: "b1",
          pickup_location_id: "branch:b1",
          customer_location_id: "customer:b-afternoon",
          required_arrival_minute: 900,
          estimated_service_end_minute: 960,
          permitted_return_location_id: "branch:b1",
          passenger_seats: 1,
          is_final_appointment: true,
        },
      ],
      transport_obligations: [],
      travel_info: {
        locations: [{ location_id: "branch:b1", label: "Main", lat: 10.7, lng: 122.9, location_type: "branch", branch_id: "b1" }],
        travel_time_minutes: [[0]],
        travel_distance_km: [[0]],
        matrix_version: "m1",
        generated_at: "2026-11-18T00:00:00Z",
      },
      config: { solver_time_limit_seconds: 5, allow_partial_service: true, allow_delivery_when_collection_undecided: true, deterministic_seed: 42 },
    } as OptimizerRequestPayload;

    const resp: OptimizerResponsePayload = {
      snapshot_id: "snap-tour-test",
      feasibility_status: "feasible",
      all_obligations_served: true,
      collection_plan_safe: true,
      operational_commitment_allowed: true,
      routes: [
        {
          driver_id: "drv-1",
          driver_name: "Driver 1",
          vehicle_capacity: 4,
          stops: [
            { sequence_index: 0, stop_type: "driver_start", location_id: "branch:b1", location_label: "Main", arrival_minute: 560, departure_minute: 570 },
            { sequence_index: 1, stop_type: "pickup", obligation_id: "del:b-morning", booking_id: "b-morning", therapist_id: "t1", leg_type: "delivery", location_id: "branch:b1", location_label: "Main", arrival_minute: 570, departure_minute: 572 },
            { sequence_index: 2, stop_type: "dropoff", obligation_id: "del:b-morning", booking_id: "b-morning", therapist_id: "t1", leg_type: "delivery", location_id: "customer:b-morning", location_label: "Cust 1", arrival_minute: 590, departure_minute: 592 },
            { sequence_index: 3, stop_type: "pickup", obligation_id: "del:b-afternoon", booking_id: "b-afternoon", therapist_id: "t2", leg_type: "delivery", location_id: "branch:b1", location_label: "Main", arrival_minute: 870, departure_minute: 872 },
            { sequence_index: 4, stop_type: "dropoff", obligation_id: "del:b-afternoon", booking_id: "b-afternoon", therapist_id: "t2", leg_type: "delivery", location_id: "customer:b-afternoon", location_label: "Cust 2", arrival_minute: 890, departure_minute: 892 },
            { sequence_index: 5, stop_type: "driver_return", location_id: "branch:b1", location_label: "Main", arrival_minute: 910, departure_minute: 910 },
          ],
          assigned_obligation_ids: ["del:b-morning", "del:b-afternoon"],
          driving_minutes: 60,
          distance_km: 20,
          peak_occupancy: 1,
        },
      ],
      assignments: [],
      return_decisions: [],
      collection_coverage: [],
      unassigned_obligations: [],
      constraint_violations: [],
      infeasibility_reasons: [],
      metrics: {
        total_driving_minutes: 60,
        total_distance_km: 20,
        pooled_route_count: 0,
        pooled_leg_count: 0,
        active_driver_count: 1,
        served_obligation_count: 2,
        unassigned_obligation_count: 0,
      },
      matrix_version: "m1",
    };

    const updates = buildBookingUpdatesFromOptimizerResponse(req, resp);
    const uMorning = updates.find((u) => u.bookingId === "b-morning");
    const uAfternoon = updates.find((u) => u.bookingId === "b-afternoon");
    expect(uMorning?.vehicleJourneyId).toBeTruthy();
    expect(uAfternoon?.vehicleJourneyId).toBeTruthy();
    expect(uMorning?.vehicleJourneyId).not.toBe(uAfternoon?.vehicleJourneyId);
  });

  it("enforces room_reset_buffer_minutes in slot filter and blocks lent therapists on home branch", async () => {
    const db = fakeDatabase({
      branch_resources: [{ id: "r1", branch_id: "b1", capacity: 1, is_active: true }],
      bookings: [
        {
          id: "bk-room",
          branch_id: "b1",
          booking_date: "2026-11-20",
          staff_id: "t-other",
          resource_id: "r1",
          start_time: "10:00:00",
          end_time: "11:00:00",
          status: "confirmed",
          hold_expires_at: null,
          delivery_type: "in_spa",
          travel_buffer_mins: null,
          session_due_at: null,
          metadata: {},
        },
      ],
      branch_booking_rules: [{ branch_id: "b1", travel_buffer_mins: 30 }],
      scheduling_rules: [{ branch_id: "b1", home_service_travel_buffer_minutes: 30, room_reset_buffer_minutes: 15 }],
      workflow_tasks: [],
    });

    const filtered = await filterSlotsByRoomAndHomeTravel({
      supabase: db.client as never,
      branchId: "b1",
      date: "2026-11-20",
      deliveryMode: "in_spa",
      blockMinutes: 60,
      slots: [
        { staff_id: "t1", slot_time: "11:00:00", available: true }, // Hits 15m reset buffer until 11:15
        { staff_id: "t1", slot_time: "11:30:00", available: true }, // Clear after reset
      ],
    });
    expect(filtered[0]!.available).toBe(false);
    expect(filtered[1]!.available).toBe(true);

    // Home-branch therapist lent to SM branch must be excluded on home branch during lending window
    const lentSolve = solveOnsiteFallback({
      branch_id: "b1",
      date: "2026-11-20",
      branch_open_minute: 600,
      branch_close_minute: 1320,
      slot_interval_minutes: 30,
      room_reset_buffer_minutes: 10,
      mode: "assign_order",
      requested_start_minute: 720,
      candidate_start_minutes: [],
      allow_alternative_times: false,
      allow_earlier_opportunities: false,
      max_alternatives: 0,
      enforce_room_capacity: true,
      group_room_policy: "prefer_together",
      therapists: [
        {
          staff_id: "t-lent",
          name: "Lent Therapist",
          home_branch_id: "b1",
          seniority_rank: 1,
          completed_count_today: 0,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1320 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [
            {
              requesting_branch_id: "sm-branch",
              start_minute: 700,
              end_minute: 900,
              visit_type: "in_spa",
            },
          ],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 0,
          existing_working_minutes_today: 0,
        },
      ],
      resources: [
        {
          resource_id: "r1",
          name: "Room 1",
          resource_type: "single_room",
          capacity: 1,
          sort_order: 1,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: null,
          turnover_start_minute: null,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
      ],
      requirements: [
        {
          line_id: "l1",
          attendee_id: "g1",
          line_index: 0,
          service_id: "svc-1",
          service_name: "Massage",
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          requires_room: true,
          preferred_staff_id: null,
          locked_staff_id: null,
          locked_resource_id: null,
          allowed_resource_types: [],
        },
      ],
    });
    expect(lentSolve.feasible).toBe(false);
  });

  it("TS fallback detects room capacity bottleneck, driver stale GPS, lending overlap, and earlier slots", () => {
    const res = evaluateUnifiedOperationsFallback({
      branch_id: "b1",
      branch_name: "Main Spa",
      date: "2026-11-20",
      now_minute: 660,
      source_snapshot_version: "snap-fallback-parity",
      rules: {
        travel_buffer_minutes: 30,
        scheduling_home_buffer_minutes: 30,
        room_reset_buffer_minutes: 10,
        in_spa_open_minute: 600,
        in_spa_close_minute: 1320,
        home_open_minute: null,
        home_close_minute: null,
        min_daily_therapists: 1,
      },
      therapists: [
        {
          staff_id: "t1",
          name: "Therapist 1",
          home_branch_id: "b1",
          seniority_rank: 1,
          completed_count_today: 0,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1320 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 2,
          existing_working_minutes_today: 120,
        },
        {
          staff_id: "t2",
          name: "Therapist 2",
          home_branch_id: "b1",
          seniority_rank: 2,
          completed_count_today: 0,
          checked_in: true,
          qualified_service_ids: ["svc-1"],
          shift_windows: [{ start_minute: 600, end_minute: 1320 }],
          break_windows: [],
          blocked_windows: [],
          assistance_windows: [],
          busy_windows: [],
          max_services_per_day: null,
          max_working_minutes_per_day: null,
          existing_service_count_today: 1,
          existing_working_minutes_today: 60,
        },
      ],
      drivers: [
        {
          driver_id: "d1",
          name: "Driver 1",
          home_branch_id: "b1",
          allowed_branch_ids: ["b1"],
          shift_windows: [{ start_minute: 540, end_minute: 1320 }],
          checked_in: true,
          gps_age_seconds: 1200,
          gps_accuracy_meters: 15,
          gps_offline: false,
          gps_permission_missing: false,
          lat: 10.67,
          lng: 122.95,
        },
      ],
      resources: [
        {
          resource_id: "r1",
          name: "Room 1",
          resource_type: "single_room",
          capacity: 1,
          sort_order: 1,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: null,
          turnover_start_minute: null,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
        {
          resource_id: "r2",
          name: "Room 2",
          resource_type: "single_room",
          capacity: 1,
          sort_order: 2,
          is_active: true,
          allowed_service_ids: [],
          active_turnover_until_minute: null,
          turnover_start_minute: null,
          reset_buffer_minutes: 10,
          busy_windows: [],
        },
      ],
      bookings: [
        {
          booking_id: "bk-1",
          order_id: null,
          customer_name: "Guest 1",
          service_id: "svc-1",
          service_name: "Massage",
          delivery_type: "in_spa",
          status: "confirmed",
          booking_progress_status: "confirmed",
          tracking_status: null,
          therapist_id: "t1",
          therapist_selection_source: null,
          driver_id: null,
          collection_driver_id: null,
          resource_id: "r1",
          start_minute: 780,
          end_minute: 840,
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          travel_buffer_minutes: null,
          live_eta_minutes: null,
          distance_km: null,
          session_started_minute: null,
          session_due_minute: null,
          projected_end_minute: null,
          collection_decision: null,
          has_valid_customer_location: true,
          requires_room: true,
        },
        {
          booking_id: "bk-2",
          order_id: null,
          customer_name: "Guest 2",
          service_id: "svc-1",
          service_name: "Massage",
          delivery_type: "in_spa",
          status: "confirmed",
          booking_progress_status: "confirmed",
          tracking_status: null,
          therapist_id: "t2",
          therapist_selection_source: null,
          driver_id: null,
          collection_driver_id: null,
          resource_id: "r1",
          start_minute: 800,
          end_minute: 860,
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          travel_buffer_minutes: null,
          live_eta_minutes: null,
          distance_km: null,
          session_started_minute: null,
          session_due_minute: null,
          projected_end_minute: null,
          collection_decision: null,
          has_valid_customer_location: true,
          requires_room: true,
        },
        {
          booking_id: "bk-hs-gps",
          order_id: null,
          customer_name: "Home Guest",
          service_id: "svc-1",
          service_name: "Massage",
          delivery_type: "home_service",
          status: "confirmed",
          booking_progress_status: "confirmed",
          tracking_status: null,
          therapist_id: "t1",
          therapist_selection_source: null,
          driver_id: "d1",
          collection_driver_id: null,
          resource_id: null,
          start_minute: 960,
          end_minute: 1020,
          duration_minutes: 60,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          travel_buffer_minutes: 30,
          live_eta_minutes: null,
          distance_km: null,
          session_started_minute: null,
          session_due_minute: null,
          projected_end_minute: null,
          collection_decision: null,
          has_valid_customer_location: true,
          requires_room: false,
        },
      ],
      room_turnovers: [],
      assistance_requests: [
        {
          request_id: "ast-1",
          requesting_branch_id: "sm-branch",
          lending_branch_id: "b1",
          status: "approved_pending_arrival",
          visit_type: "in_spa",
          start_minute: 750,
          end_minute: 900,
          selected_staff_ids: ["t1"],
        },
      ],
    });

    const issueTypes = new Set(res.conflicts_and_opportunities.map((c) => c.issue_type));
    expect(issueTypes.has("room_capacity_bottleneck")).toBe(true);
    expect(issueTypes.has("location_or_gps_degraded")).toBe(true);
    expect(issueTypes.has("rule_drift_or_cross_branch_gap")).toBe(true);
    expect(issueTypes.has("earlier_slot_opportunity")).toBe(true);
  });
});
