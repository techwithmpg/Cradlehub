import { describe, expect, it } from "vitest";
import {
  buildLiveMapDriversViewModel,
  classifyDriverLocation,
  computeCrmServiceTimerSummary,
  mergeMonotonicGpsLocation,
  parseCollectionRequirement,
  presentCrmJourneyStatus,
} from "@/lib/dispatch/crm-live-map-model";
import {
  ArrivalDeduplicationStore,
  deriveAuthoritativeTransitionEvents,
  validateArrivalEvent,
  type ArrivalValidationContext,
} from "@/lib/dispatch/arrival-events";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const NOW = Date.parse("2026-11-17T06:00:00Z");
const BRANCH_ID = "branch-main";

function makeBooking(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: "booking-1",
    branchId: BRANCH_ID,
    number: "#001",
    bookingDate: "2026-11-17",
    startTime: "14:00:00",
    endTime: "15:00:00",
    durationMinutes: 60,
    customerName: "Customer A",
    serviceName: "Prenatal Massage",
    area: "Makati",
    formattedAddress: "Makati Ave",
    lat: 14.5547,
    lng: 121.0244,
    branchName: "Main Branch",
    branchLat: 14.5995,
    branchLng: 120.9842,
    needsLocationReview: false,
    driverId: "driver-1",
    driverName: "Carlos Driver",
    therapistId: "therapist-1",
    therapistName: "Therapist Maria",
    dispatchStatus: "in_route",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    paymentStatus: "paid",
    etaMinutes: 14,
    eta: {
      minutes: 14,
      source: "stored_routes_api",
      calculatedAt: new Date(NOW - 30_000).toISOString(),
      origin: "driver_location",
    },
    travelStartedAt: new Date(NOW - 300_000).toISOString(),
    arrivedAt: null,
    sessionStartedAt: null,
    sessionDueAt: null,
    sessionCompletedAt: null,
    sessionCompletionSource: null,
    completedAt: null,
    rating: null,
    currentLocation: {
      lat: 14.58,
      lng: 121.0,
      recorded_at: new Date(NOW - 30_000).toISOString(),
      accuracyMeters: 12,
      staffId: "driver-1",
    },
    ...overrides,
  };
}

describe("O2 CRM Live Map — Domain Model, GPS Reliability, Arrivals & Collection Rules", () => {
  it("Scenario 1 & 2: displays multiple drivers simultaneously and moves markers monotonically", () => {
    const driver1Booking = makeBooking({ id: "b-1", driverId: "driver-1", driverName: "Carlos" });
    const driver2Booking = makeBooking({
      id: "b-2",
      number: "#002",
      driverId: "driver-2",
      driverName: "Elena",
      customerName: "Customer B",
      therapistId: "therapist-2",
      therapistName: "Therapist Joy",
      lat: 14.61,
      lng: 121.03,
      currentLocation: {
        lat: 14.602,
        lng: 121.01,
        recorded_at: new Date(NOW - 45_000).toISOString(),
        accuracyMeters: 15,
        staffId: "driver-2",
      },
    });

    const initial = buildLiveMapDriversViewModel({
      items: [driver1Booking, driver2Booking],
      nowMs: NOW,
    });

    expect(initial.drivers).toHaveLength(2);
    expect(initial.drivers.map((d) => d.driverName)).toEqual(["Carlos", "Elena"]);
    // Customer pin never conflated with driver location
    expect(initial.drivers[0]!.location?.lat).toBe(14.58);
    expect(initial.drivers[0]!.nextStop?.lat).toBe(14.5547);

    // Out-of-order packet older than current snapshot is rejected; newer moves only driver-1
    const outOfOrder = mergeMonotonicGpsLocation(initial.drivers[0]!.location, {
      lat: 14.51,
      lng: 120.95,
      recordedAt: new Date(NOW - 120_000).toISOString(),
      accuracyMeters: 10,
    });
    expect(outOfOrder?.lat).toBe(14.58);

    const newerOverrides = new Map([
      [
        "driver:driver-1",
        {
          lat: 14.565,
          lng: 121.015,
          recordedAt: new Date(NOW - 5_000).toISOString(),
          accuracyMeters: 8,
        },
      ],
    ]);
    const moved = buildLiveMapDriversViewModel({
      items: [driver1Booking, driver2Booking],
      locationOverrides: newerOverrides,
      nowMs: NOW,
    });
    expect(moved.drivers[0]!.location?.lat).toBe(14.565);
    expect(moved.drivers[1]!.location?.lat).toBe(14.602);
  });

  it("Scenario 3: never labels delayed, stale, poor accuracy, offline, or missing-permission GPS as live", () => {
    const delayed = classifyDriverLocation(
      { lat: 14.58, lng: 121.0, recordedAt: new Date(NOW - 4 * 60_000).toISOString(), accuracyMeters: 10 },
      { nowMs: NOW }
    );
    expect(delayed.isLive).toBe(false);
    expect(delayed.state).toBe("delayed");
    expect(delayed.label).toContain("not live");

    const stale = classifyDriverLocation(
      { lat: 14.58, lng: 121.0, recordedAt: new Date(NOW - 20 * 60_000).toISOString(), accuracyMeters: 10 },
      { nowMs: NOW }
    );
    expect(stale.isLive).toBe(false);
    expect(stale.state).toBe("stale");
    expect(stale.label).toContain("not live");

    const coarse = classifyDriverLocation(
      { lat: 14.58, lng: 121.0, recordedAt: new Date(NOW - 10_000).toISOString(), accuracyMeters: 220 },
      { nowMs: NOW }
    );
    expect(coarse.isLive).toBe(false);
    expect(coarse.state).toBe("poor_accuracy");
    expect(coarse.label).toContain("±220m");

    const missingPerm = classifyDriverLocation(null, { nowMs: NOW, permissionMissing: true });
    expect(missingPerm.isLive).toBe(false);
    expect(missingPerm.state).toBe("permission_missing");
    expect(missingPerm.note).toContain("does not mean work stopped");

    const offline = classifyDriverLocation(
      { lat: 14.58, lng: 121.0, recordedAt: new Date(NOW - 60_000).toISOString() },
      { nowMs: NOW, driverOffline: true }
    );
    expect(offline.isLive).toBe(false);
    expect(offline.state).toBe("offline");
  });

  it("Scenario 5 & 6: reassigning moves route cleanly and cancelled bookings leave active drivers", () => {
    const assignedTo1 = makeBooking({ id: "b-reassign", driverId: "driver-1", driverName: "Carlos" });
    const cancelled = makeBooking({
      id: "b-cancelled",
      driverId: "driver-2",
      driverName: "Elena",
      bookingStatus: "cancelled",
    });

    const before = buildLiveMapDriversViewModel({ items: [assignedTo1, cancelled], nowMs: NOW });
    expect(before.drivers).toHaveLength(1);
    expect(before.drivers[0]!.driverId).toBe("driver-1");
    expect(before.terminalBookingIds).toEqual(["b-cancelled"]);

    const reassigned = makeBooking({ id: "b-reassign", driverId: "driver-3", driverName: "Marco" });
    const after = buildLiveMapDriversViewModel({ items: [reassigned, cancelled], nowMs: NOW });
    expect(after.drivers).toHaveLength(1);
    expect(after.drivers[0]!.driverId).toBe("driver-3");
    expect(after.drivers[0]!.routeKey).not.toBe(before.drivers[0]!.routeKey);
  });

  it("Scenario 12, 13 & 14: multi-therapist stops stay separate, driver events isolated, GPS arrival never confirms boarding/drop-off", () => {
    const stop1 = makeBooking({
      id: "b-stop-1",
      number: "#001",
      startTime: "14:00:00",
      customerName: "Customer A",
      therapistId: "t-maria",
      therapistName: "Therapist Maria",
      driverId: "driver-1",
      driverName: "Carlos",
      bookingProgressStatus: "travel_started",
      lat: 14.55,
      lng: 121.02,
    });
    const stop2 = makeBooking({
      id: "b-stop-2",
      number: "#002",
      startTime: "15:00:00",
      customerName: "Customer B",
      therapistId: "t-ana",
      therapistName: "Therapist Ana",
      driverId: "driver-1",
      driverName: "Carlos",
      bookingProgressStatus: "travel_started",
      lat: 14.57,
      lng: 121.04,
    });
    const otherDriverBooking = makeBooking({
      id: "b-other",
      driverId: "driver-2",
      driverName: "Elena",
      therapistId: "t-joy",
      therapistName: "Therapist Joy",
    });

    const context: ArrivalValidationContext = {
      expectedBranchId: BRANCH_ID,
      bookingsById: new Map([
        [stop1.id, { id: stop1.id, branchId: BRANCH_ID, driverId: "driver-1", bookingStatus: "confirmed", bookingProgressStatus: "travel_started" }],
        [stop2.id, { id: stop2.id, branchId: BRANCH_ID, driverId: "driver-1", bookingStatus: "confirmed", bookingProgressStatus: "travel_started" }],
        [otherDriverBooking.id, { id: otherDriverBooking.id, branchId: BRANCH_ID, driverId: "driver-2", bookingStatus: "confirmed", bookingProgressStatus: "travel_started" }],
      ]),
      nowMs: NOW,
    };

    // Event from driver-2 claiming arrival at driver-1's booking MUST fail (Scenario 12)
    const crossDriverAttempt = validateArrivalEvent(
      {
        eventId: "ev-cross",
        kind: "customer_arrival",
        source: "synthetic_test_event",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: "driver-2",
        driverName: "Elena",
        bookingId: stop1.id,
        destinationLabel: "Makati",
        therapistNames: ["Therapist Maria"],
        accuracyMeters: 15,
        observedAt: new Date(NOW).toISOString(),
      },
      context
    );
    expect(crossDriverAttempt.ok).toBe(false);
    if (!crossDriverAttempt.ok) expect(crossDriverAttempt.reason).toBe("driver_assignment_mismatch");

    // Pickup arrival does NOT confirm therapist boarding (Scenario 14)
    const store = new ArrivalDeduplicationStore();
    store.accept(
      {
        eventId: "ev-pickup-1",
        kind: "pickup_arrival",
        source: "synthetic_test_event",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: "driver-1",
        driverName: "Carlos",
        bookingId: stop1.id,
        destinationLabel: "Main Branch",
        therapistNames: ["Therapist Maria", "Therapist Ana"],
        accuracyMeters: 10,
        observedAt: new Date(NOW - 30_000).toISOString(),
      },
      context
    );
    const afterPickup = buildLiveMapDriversViewModel({
      items: [makeBooking({ ...stop1, bookingProgressStatus: "not_started" }), makeBooking({ ...stop2, bookingProgressStatus: "not_started" })],
      arrivalsByBooking: new Map([[stop1.id, store.getLatestForBooking(stop1.id)!]]),
      nowMs: NOW,
    });
    expect(afterPickup.drivers[0]!.stops[0]!.statusLabel).toBe("Arrived at pickup");
    expect(afterPickup.drivers[0]!.stops[0]!.boardingConfirmed).toBe(false);

    // Arrival at Stop 1 updates Stop 1 to "Arrived at customer" without marking Stop 2 dropped off (Scenario 13)
    const storeCustomer = new ArrivalDeduplicationStore();
    storeCustomer.accept(
      {
        eventId: "ev-cust-1",
        kind: "customer_arrival",
        source: "synthetic_test_event",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: "driver-1",
        driverName: "Carlos",
        bookingId: stop1.id,
        stopId: "stop-1",
        destinationLabel: "Makati Ave",
        customerName: "Customer A",
        therapistNames: ["Therapist Maria"],
        accuracyMeters: 10,
        observedAt: new Date(NOW - 5_000).toISOString(),
      },
      context
    );
    const vmMultiStop = buildLiveMapDriversViewModel({
      items: [stop1, stop2, otherDriverBooking],
      arrivalsByBooking: new Map([[stop1.id, storeCustomer.getLatestForBooking(stop1.id)!]]),
      nowMs: NOW,
    });
    const carlos = vmMultiStop.drivers.find((d) => d.driverId === "driver-1")!;
    expect(carlos.stops).toHaveLength(2);
    expect(carlos.stops[0]!.therapistName).toBe("Therapist Maria");
    expect(carlos.stops[0]!.statusLabel).toBe("Arrived at customer");
    expect(carlos.stops[1]!.therapistName).toBe("Therapist Ana");
    expect(carlos.stops[1]!.statusLabel).toBe("En route");
  });

  it("Scenario 15 & 16: countdown at zero stays predictive and never auto-completes; actual completion updates CRM", () => {
    const overdueTimer = computeCrmServiceTimerSummary({
      bookingStatus: "in_progress",
      bookingProgressStatus: "session_started",
      sessionStartedAt: new Date(NOW - 65 * 60_000).toISOString(),
      sessionDueAt: new Date(NOW - 5 * 60_000).toISOString(),
      durationMinutes: 60,
      nowMs: NOW,
    });

    expect(overdueTimer.isCompleted).toBe(false);
    expect(overdueTimer.isEndingSoon).toBe(true);
    expect(overdueTimer.remainingSeconds).toBe(0);
    expect(overdueTimer.predictiveNote).toContain("therapist confirmation still required");

    const presentationBeforeConfirm = presentCrmJourneyStatus({
      bookingStatus: "in_progress",
      bookingProgressStatus: "session_started",
      driverId: "driver-1",
      serviceTimer: overdueTimer,
      collection: parseCollectionRequirement({}),
    });
    expect(presentationBeforeConfirm.statusLabel).toBe("Service in progress");

    // Authoritative completion transition updates CRM status to Ready for collection / Service completed
    const confirmedTimer = computeCrmServiceTimerSummary({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      sessionStartedAt: new Date(NOW - 65 * 60_000).toISOString(),
      sessionCompletedAt: new Date(NOW - 1_000).toISOString(),
      sessionCompletionSource: "staff_manual",
      durationMinutes: 60,
      nowMs: NOW,
    });
    expect(confirmedTimer.isCompleted).toBe(true);

    const presentationAfterConfirm = presentCrmJourneyStatus({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      driverId: "driver-1",
      serviceTimer: confirmedTimer,
      collection: parseCollectionRequirement({
        rawRequirement: { decision: "required", source: "schedule" },
      }),
    });
    expect(presentationAfterConfirm.statusLabel).toBe("Ready for collection");
  });

  it("Scenario 17 & 18: approved independent departure suppresses false collection alerts; unverified or conflicting decisions become undecided", () => {
    // Approved not_required -> Completed, zero false collection alerts
    const approvedHome = makeBooking({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      sessionCompletedAt: new Date(NOW).toISOString(),
      sessionCompletionSource: "staff_manual",
      collectionRequirement: {
        decision: "not_required",
        source: "schedule",
        approvedBy: "manager-1",
        approvedAt: new Date(NOW - 3_600_000).toISOString(),
      },
    });
    const parsedApproved = parseCollectionRequirement({
      rawRequirement: approvedHome.collectionRequirement,
    });
    expect(parsedApproved.decision).toBe("not_required");
    expect(parsedApproved.hasValidApproval).toBe(true);

    const transitionEvents = deriveAuthoritativeTransitionEvents({
      branchId: BRANCH_ID,
      previousData: {
        today: "2026-11-17",
        items: [makeBooking({ ...approvedHome, bookingStatus: "in_progress", bookingProgressStatus: "session_started", sessionCompletedAt: null })],
        alerts: [],
        stats: { totalToday: 1, awaitingDispatch: 0, activeTrips: 1, completedToday: 0, cancelledToday: 0 },
      },
      nextData: {
        today: "2026-11-17",
        items: [approvedHome],
        alerts: [],
        stats: { totalToday: 1, awaitingDispatch: 0, activeTrips: 0, completedToday: 1, cancelledToday: 0 },
      },
    });
    expect(transitionEvents).toHaveLength(0);

    // Unverified not_required (missing approval metadata) -> forced undecided (Scenario 18)
    const unverified = parseCollectionRequirement({
      rawRequirement: { decision: "not_required" },
    });
    expect(unverified.decision).toBe("undecided");
    expect(unverified.requiresResolution).toBe(true);

    // Conflicting approval -> forced undecided (Scenario 18)
    const conflicting = parseCollectionRequirement({
      rawRequirement: {
        decision: "not_required",
        source: "schedule",
        approvedBy: "mgr-1",
        approvedAt: new Date(NOW).toISOString(),
        conflictingApproval: true,
      },
    });
    expect(conflicting.decision).toBe("undecided");
    expect(conflicting.requiresResolution).toBe(true);

    // Completed booking with unresolved collection requirement stays visible as Service completed + undecided
    const vmUndecided = buildLiveMapDriversViewModel({
      items: [
        makeBooking({
          bookingStatus: "completed",
          bookingProgressStatus: "completed",
          sessionCompletedAt: new Date(NOW).toISOString(),
          sessionCompletionSource: "staff_manual",
        }),
      ],
      nowMs: NOW,
    });
    expect(vmUndecided.drivers).toHaveLength(1);
    expect(vmUndecided.drivers[0]!.currentStatusLabel).toBe("Service completed");
    expect(vmUndecided.drivers[0]!.collectionSummary?.decision).toBe("undecided");
    expect(vmUndecided.drivers[0]!.collectionSummary?.requiresResolution).toBe(true);
  });
});
