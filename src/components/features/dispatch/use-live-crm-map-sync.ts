"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { getCrmDriverRouteAction } from "@/lib/actions/dispatch-live-map-actions";
import { createClient } from "@/lib/supabase/client";
import {
  ArrivalDeduplicationStore,
  deriveAuthoritativeTransitionEvents,
  type AcceptedArrivalRecord,
  type ArrivalRejectionReason,
  type ArrivalValidationContext,
  type CrmArrivalEventKind,
} from "@/lib/dispatch/arrival-events";
import {
  buildLiveMapDriversViewModel,
  mergeMonotonicGpsLocation,
  parseCollectionRequirement,
  type DriverGpsSnapshot,
  type DriverRouteDisplayMetrics,
  type LiveMapDriversViewModel,
  type RealtimeConnectionState,
} from "@/lib/dispatch/crm-live-map-model";
import {
  buildLiveMapTripsViewModel,
  type LiveMapTripItem,
  type TripFilterCounts,
} from "@/lib/dispatch/trip-presentation";
import {
  isValidGeoPoint,
  shouldRecomputeDriverRoute,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";
import type { DispatchData } from "@/lib/queries/dispatch-queries";

const MAP_POLL_INTERVAL_MS = 15_000;
const FRESHNESS_TICK_MS = 15_000;

function isSafeToastMoment(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  if (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
    )
  ) {
    return false;
  }
  const active = document.activeElement;
  return !(
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}

function presentArrivalToast(
  record: AcceptedArrivalRecord,
  onSelectBooking?: (bookingId: string) => void
) {
  toast(record.copy.title, {
    id: record.semanticKey,
    description: record.copy.body,
    duration: 8_000,
    ...(onSelectBooking
      ? {
        action: {
          label: "Focus",
          onClick: () => onSelectBooking(record.event.bookingId),
        },
      }
      : {}),
  });
}

function buildValidationContext(
  data: DispatchData,
  branchId: string,
  nowMs: number
): ArrivalValidationContext {
  const bookingsById = new Map<
    string,
    ArrivalValidationContext["bookingsById"] extends ReadonlyMap<string, infer V> ? V : never
  >();
  const journeysById = new Map(
    (data.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])
  );

  for (const item of data.items) {
    const journey = journeysById.get(item.id) ?? null;
    const collection = parseCollectionRequirement({
      rawRequirement: item.collectionRequirement,
      transportJourney: journey,
    });
    bookingsById.set(item.id, {
      id: item.id,
      branchId: item.branchId ?? branchId,
      driverId: item.driverId,
      bookingStatus: item.bookingStatus,
      bookingProgressStatus: item.bookingProgressStatus,
      sessionCompletedAt: item.sessionCompletedAt ?? item.completedAt ?? null,
      sessionCompletionSource: item.sessionCompletionSource ?? null,
      collection: {
        decision: collection.decision,
        hasValidApproval: collection.hasValidApproval,
        collectionDriverId: collection.collectionDriverId,
      },
    });
  }

  return {
    expectedBranchId: branchId,
    bookingsById,
    journeysByBookingId: journeysById,
    nowMs,
  };
}

function snapshotArrivalsMap(
  store: ArrivalDeduplicationStore,
  data: DispatchData
): Map<string, Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>>> {
  const map = new Map<string, Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>>>();
  for (const item of data.items) {
    const latest = store.getLatestForBooking(item.id);
    if (latest) map.set(item.id, latest);
  }
  for (const entry of data.transportJourneys ?? []) {
    if (!map.has(entry.journey.bookingId)) {
      const latest = store.getLatestForBooking(entry.journey.bookingId);
      if (latest) map.set(entry.journey.bookingId, latest);
    }
  }
  return map;
}

export interface LiveCrmMapSyncState {
  nowMs: number;
  connectionState: RealtimeConnectionState;
  viewModel: LiveMapDriversViewModel;
  tripsViewModel: {
    trips: LiveMapTripItem[];
    counts: TripFilterCounts;
  };
  routesByDriver: ReadonlyMap<string, RouteCacheEntry>;
  arrivalFeed: AcceptedArrivalRecord[];
  receiveArrivalEvent: (
    rawEvent: unknown,
    options?: { silent?: boolean }
  ) =>
    | { accepted: true; duplicate: boolean; shouldNotify: boolean; record: AcceptedArrivalRecord }
    | { accepted: false; reason: ArrivalRejectionReason; message: string };
}

export function useLiveCrmMapSync(input: {
  data: DispatchData;
  branchId?: string | null;
  onRefresh?: () => void | Promise<unknown>;
  onSelectBooking?: (bookingId: string) => void;
  disableAutoRoutes?: boolean;
}): LiveCrmMapSyncState {
  const { data, branchId: explicitBranchId, onRefresh, onSelectBooking, disableAutoRoutes } = input;
  const resolvedBranchId =
    explicitBranchId ??
    data.items.find((item) => typeof item.branchId === "string")?.branchId ??
    "default-branch";

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "disconnected" : "connected"
  );
  const [locationOverrides, setLocationOverrides] = useState<Map<string, DriverGpsSnapshot>>(
    () => new Map()
  );
  const [routesByDriver, setRoutesByDriver] = useState<Map<string, RouteCacheEntry>>(
    () => new Map()
  );
  const [arrivalFeed, setArrivalFeed] = useState<AcceptedArrivalRecord[]>([]);
  const [arrivalsByBooking, setArrivalsByBooking] = useState<
    Map<string, Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>>>
  >(() => new Map());

  const arrivalStoreRef = useRef(new ArrivalDeduplicationStore());
  const previousDataRef = useRef<DispatchData | null>(null);
  const dataRef = useRef<DispatchData>(data);
  const deferredToastsRef = useRef<Map<string, AcceptedArrivalRecord>>(new Map());
  const inFlightRoutesRef = useRef<Set<string>>(new Set());
  const routesRef = useRef(routesByDriver);
  const refreshRef = useRef(onRefresh);
  const selectBookingRef = useRef(onSelectBooking);

  useEffect(() => {
    routesRef.current = routesByDriver;
    refreshRef.current = onRefresh;
    selectBookingRef.current = onSelectBooking;
    dataRef.current = data;
  }, [routesByDriver, onRefresh, onSelectBooking, data]);

  const triggerToastSafely = useCallback((record: AcceptedArrivalRecord) => {
    if (!isSafeToastMoment()) {
      deferredToastsRef.current.set(record.semanticKey, record);
      return;
    }
    presentArrivalToast(record, selectBookingRef.current);
  }, []);

  // Flush deferred arrival notifications once inputs/dialogs close
  useEffect(() => {
    const flush = () => {
      if (!isSafeToastMoment() || deferredToastsRef.current.size === 0) return;
      for (const [key, record] of deferredToastsRef.current.entries()) {
        deferredToastsRef.current.delete(key);
        presentArrivalToast(record, selectBookingRef.current);
      }
    };
    window.addEventListener("focus", flush);
    document.addEventListener("focusout", flush);
    document.addEventListener("visibilitychange", flush);
    const interval = window.setInterval(flush, 2_000);
    return () => {
      window.removeEventListener("focus", flush);
      document.removeEventListener("focusout", flush);
      document.removeEventListener("visibilitychange", flush);
      window.clearInterval(interval);
    };
  }, []);

  // Refresh GPS freshness & map summaries every 15s (live per-second countdown stays isolated in ContextualJourneyPanel)
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), FRESHNESS_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Reconcile authoritative DispatchData updates without synchronous cascading state sets in effects
  useEffect(() => {
    let cancelled = false;
    const currentNow = Date.now();
    const prevData = previousDataRef.current;
    previousDataRef.current = data;

    if (!prevData) {
      for (const item of data.items) {
        if (["cancelled", "no_show", "expired"].includes(item.bookingStatus)) continue;
        if (item.bookingProgressStatus === "arrived" && item.driverId) {
          arrivalStoreRef.current.seedSilent({
            eventId: `booking:${item.id}:customer_arrival:${item.arrivedAt ?? "arrived"}`,
            kind: "customer_arrival",
            source: "server_booking_arrived",
            authorizedByServer: true,
            branchId: item.branchId ?? resolvedBranchId,
            driverId: item.driverId,
            driverName: item.driverName,
            bookingId: item.id,
            destinationLabel: item.area ?? item.formattedAddress ?? item.customerName,
            customerName: item.customerName,
            therapistIds: item.therapistId ? [item.therapistId] : [],
            therapistNames: item.therapistName ? [item.therapistName] : [],
            observedAt: item.arrivedAt ?? new Date(currentNow).toISOString(),
            revision: 1,
          });
        }
      }
      for (const entry of data.transportJourneys ?? []) {
        const j = entry.journey;
        const seedKind: CrmArrivalEventKind | null =
          j.stage === "pickup_arrived"
            ? "pickup_arrival"
            : j.stage === "customer_arrived"
              ? "customer_arrival"
              : j.stage === "collection_arrived"
                ? "collection_arrival"
                : j.stage === "collection_pending"
                  ? "collection_ready"
                  : null;
        if (seedKind) {
          arrivalStoreRef.current.seedSilent({
            eventId: `journey:${j.bookingId}:${j.stage}:r${j.revision}`,
            kind: seedKind,
            source:
              seedKind === "collection_ready"
                ? "server_service_completion"
                : "server_journey_transition",
            authorizedByServer: true,
            branchId: resolvedBranchId,
            driverId: null,
            driverName: entry.driverName,
            bookingId: j.bookingId,
            journeyId: j.bookingId,
            legId: j.leg ?? undefined,
            destinationLabel: j.destination?.label ?? "Destination",
            customerName: j.customerName ?? null,
            therapistIds: [],
            therapistNames: j.therapistName ? [j.therapistName] : [],
            observedAt: j.observedAt,
            revision: j.revision,
          });
        }
      }
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setArrivalsByBooking(snapshotArrivalsMap(arrivalStoreRef.current, data));
        setArrivalFeed(arrivalStoreRef.current.getRecentFeed());
      });
      return () => {
        cancelled = true;
      };
    }

    for (const item of data.items) {
      if (["cancelled", "no_show", "expired"].includes(item.bookingStatus)) {
        arrivalStoreRef.current.clearForBooking(item.id);
      }
    }

    const transitionEvents = deriveAuthoritativeTransitionEvents({
      branchId: resolvedBranchId,
      previousData: prevData,
      nextData: data,
    });

    if (transitionEvents.length > 0) {
      const ctx = buildValidationContext(data, resolvedBranchId, currentNow);
      const notifyQueue: AcceptedArrivalRecord[] = [];
      for (const ev of transitionEvents) {
        const result = arrivalStoreRef.current.accept(ev, ctx);
        if (result.accepted && result.shouldNotify) {
          notifyQueue.push(result.record);
        }
      }
      for (const record of notifyQueue) {
        triggerToastSafely(record);
      }
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setArrivalsByBooking(snapshotArrivalsMap(arrivalStoreRef.current, data));
        setArrivalFeed(arrivalStoreRef.current.getRecentFeed());
      });
    }

    return () => {
      cancelled = true;
    };
  }, [data, resolvedBranchId, triggerToastSafely]);

  const receiveArrivalEvent = useCallback(
    (rawEvent: unknown, options?: { silent?: boolean }) => {
      const currentNow = Date.now();
      const ctx = buildValidationContext(data, resolvedBranchId, currentNow);
      const result = arrivalStoreRef.current.accept(rawEvent, ctx, options);
      if (result.accepted) {
        setArrivalsByBooking(snapshotArrivalsMap(arrivalStoreRef.current, data));
        setArrivalFeed(arrivalStoreRef.current.getRecentFeed());
        if (result.shouldNotify) {
          triggerToastSafely(result.record);
        }
      }
      return result;
    },
    [data, resolvedBranchId, triggerToastSafely]
  );

  // Realtime booking invalidations + live background GPS poll + Supabase snapshot realtime
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void Promise.resolve(refreshRef.current?.()).catch(() => { });
      }
    };

    const handleBookingsChanged = () => refreshIfVisible();
    const handleOnline = () => {
      setConnectionState("reconnecting");
      void Promise.resolve(refreshRef.current?.())
        .then(() => setConnectionState("connected"))
        .catch(() => setConnectionState("disconnected"));
    };
    const handleOffline = () => setConnectionState("disconnected");

    window.addEventListener(BOOKINGS_CHANGED_EVENT, handleBookingsChanged);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const pollId = window.setInterval(refreshIfVisible, MAP_POLL_INTERVAL_MS);

    let disposed = false;
    let hadDisconnect = false;
    let supabaseClient: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    if (resolvedBranchId && resolvedBranchId !== "default-branch") {
      try {
        supabaseClient = createClient();
        channel = supabaseClient
          .channel(`crm-live-map-gps:${resolvedBranchId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "staff_location_snapshots",
              filter: `branch_id=eq.${resolvedBranchId}`,
            },
            (payload) => {
              if (disposed) return;
              const row = (payload.new ?? null) as Record<string, unknown> | null;
              if (!row) return;
              const staffId = typeof row.staff_id === "string" ? row.staff_id : null;
              const bookingId = typeof row.booking_id === "string" ? row.booking_id : null;
              const lat = Number(row.lat);
              const lng = Number(row.lng);
              const recordedAt = typeof row.recorded_at === "string" ? row.recorded_at : null;
              const accuracyMeters =
                row.accuracy_meters === null || row.accuracy_meters === undefined
                  ? null
                  : Number(row.accuracy_meters);

              if (!staffId || !recordedAt || !isValidGeoPoint({ lat, lng })) return;

              const assignedBooking = dataRef.current.items.find(
                (item) =>
                  item.driverId === staffId &&
                  (!bookingId || item.id === bookingId) &&
                  !["cancelled", "no_show", "expired"].includes(item.bookingStatus)
              );
              if (!assignedBooking) return;

              const incoming: DriverGpsSnapshot = {
                lat,
                lng,
                recordedAt,
                staffId,
                accuracyMeters:
                  typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters)
                    ? accuracyMeters
                    : null,
                source: typeof row.source === "string" ? row.source : "gps",
              };

              setLocationOverrides((prevMap) => {
                const nextMap = new Map(prevMap);
                const mergedDriver = mergeMonotonicGpsLocation(
                  nextMap.get(`driver:${staffId}`),
                  incoming
                );
                if (mergedDriver) nextMap.set(`driver:${staffId}`, mergedDriver);
                if (bookingId) {
                  const mergedBooking = mergeMonotonicGpsLocation(
                    nextMap.get(`booking:${bookingId}`),
                    incoming
                  );
                  if (mergedBooking) nextMap.set(`booking:${bookingId}`, mergedBooking);
                }
                return nextMap;
              });
              setNowMs(Date.now());
            }
          )
          .subscribe((status) => {
            if (disposed) return;
            if (status === "SUBSCRIBED") {
              setConnectionState("connected");
              if (hadDisconnect) {
                hadDisconnect = false;
                refreshIfVisible();
              }
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              hadDisconnect = true;
              setConnectionState("reconnecting");
            }
          });
      } catch {
        // Environment without browser Supabase config falls back gracefully to visible polling
      }
    }

    return () => {
      disposed = true;
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, handleBookingsChanged);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(pollId);
      if (supabaseClient && channel) {
        void supabaseClient.removeChannel(channel);
      }
    };
  }, [resolvedBranchId]);

  // Filter GPS overrides against current active driver assignments (handles cancellations/reassignments without effect setState)
  const effectiveLocationOverrides = useMemo(() => {
    const activeBookingDriver = new Map<string, string | null>();
    const activeDriverIds = new Set<string>();
    for (const item of data.items) {
      if (!["cancelled", "no_show", "expired"].includes(item.bookingStatus)) {
        activeBookingDriver.set(item.id, item.driverId);
        if (item.driverId) activeDriverIds.add(item.driverId);
      }
    }
    const filtered = new Map<string, DriverGpsSnapshot>();
    for (const [key, snap] of locationOverrides.entries()) {
      if (key.startsWith("booking:")) {
        const bookingId = key.slice("booking:".length);
        const expected = activeBookingDriver.get(bookingId);
        if (expected && (!snap.staffId || snap.staffId === expected)) {
          filtered.set(key, snap);
        }
      } else if (key.startsWith("driver:")) {
        const driverId = key.slice("driver:".length);
        if (activeDriverIds.has(driverId)) {
          filtered.set(key, snap);
        }
      }
    }
    return filtered;
  }, [data.items, locationOverrides]);

  const routeMetricsByDriver = useMemo(() => {
    const map = new Map<string, DriverRouteDisplayMetrics>();
    for (const [driverId, entry] of routesByDriver.entries()) {
      map.set(driverId, {
        etaMinutes: entry.durationMinutes,
        distanceMeters: entry.distanceMeters,
        estimatedArrivalIso: entry.estimatedArrivalIso,
      });
    }
    return map;
  }, [routesByDriver]);

  const viewModel = useMemo(
    () =>
      buildLiveMapDriversViewModel({
        items: data.items,
        transportJourneys: data.transportJourneys,
        locationOverrides: effectiveLocationOverrides,
        arrivalsByBooking,
        routeMetricsByDriver,
        connectionState,
        nowMs,
      }),
    [
      data.items,
      data.transportJourneys,
      effectiveLocationOverrides,
      arrivalsByBooking,
      routeMetricsByDriver,
      connectionState,
      nowMs,
    ]
  );

  const tripsViewModel = useMemo(
    () =>
      buildLiveMapTripsViewModel({
        items: data.items,
        transportJourneys: data.transportJourneys,
        drivers: viewModel.drivers,
        arrivalsByBooking,
        connectionState,
        nowMs,
      }),
    [data.items, data.transportJourneys, viewModel.drivers, arrivalsByBooking, connectionState, nowMs]
  );

  // Only expose routes that still match active driver routeKeys (auto-invalidates cancelled/reassigned trips)
  const activeRoutesByDriver = useMemo(() => {
    const filtered = new Map<string, RouteCacheEntry>();
    for (const driver of viewModel.drivers) {
      if (!driver.driverId) continue;
      const entry = routesByDriver.get(driver.driverId);
      if (entry && entry.routeKey === driver.routeKey) {
        filtered.set(driver.driverId, entry);
      }
    }
    return filtered;
  }, [routesByDriver, viewModel.drivers]);

  // Throttled Google Routes API requests for active drivers with valid GPS + destinations
  useEffect(() => {
    if (disableAutoRoutes) return;
    const currentNow = Date.now();

    for (const driver of viewModel.drivers) {
      if (!driver.driverId || !driver.location) continue;
      if (driver.driverId.startsWith("journey-driver:")) continue;
      const hasStopCoords = driver.stops.some((stop) => stop.hasAuthorizedDestination);
      if (!hasStopCoords) continue;

      const origin = { lat: driver.location.lat, lng: driver.location.lng };
      const existing = routesRef.current.get(driver.driverId);
      const flightKey = `${driver.driverId}:${driver.routeKey}`;

      if (inFlightRoutesRef.current.has(flightKey)) continue;
      if (
        !shouldRecomputeDriverRoute(
          existing,
          { routeKey: driver.routeKey, origin },
          currentNow
        )
      ) {
        continue;
      }

      inFlightRoutesRef.current.add(flightKey);
      const targetDriverId = driver.driverId;
      const targetRouteKey = driver.routeKey;
      void getCrmDriverRouteAction({
        date: data.today,
        driverId: targetDriverId,
        origin,
      })
        .then((res) => {
          if (!res.ok) return;
          setRoutesByDriver((prev) => {
            const next = new Map(prev);
            next.set(targetDriverId, {
              routeKey: targetRouteKey,
              origin,
              computedAtMs: Date.now(),
              durationMinutes: res.durationMinutes,
              distanceMeters: res.distanceMeters,
              encodedPolyline: res.encodedPolyline,
              estimatedArrivalIso: res.estimatedArrivalIso,
              basis: res.basis,
            });
            return next;
          });
        })
        .catch(() => { })
        .finally(() => {
          inFlightRoutesRef.current.delete(flightKey);
        });
    }
  }, [data.today, disableAutoRoutes, viewModel.drivers]);

  return {
    nowMs,
    connectionState,
    viewModel,
    tripsViewModel,
    routesByDriver: activeRoutesByDriver,
    arrivalFeed,
    receiveArrivalEvent,
  };
}
