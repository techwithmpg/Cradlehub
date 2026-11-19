"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { getCrmDriverRouteAction } from "@/lib/actions/dispatch-live-map-actions";
import { classifyDriverLocation } from "@/lib/dispatch/crm-live-map-model";
import {
  decodeEncodedPolyline,
  isValidGeoPoint,
  shouldRecomputeDriverRoute,
  ROUTE_CACHE_TTL_MS,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";
import { loadGoogleMaps } from "@/lib/maps/load-dispatch-map";
import type { LiveBoardData, LiveTrip } from "@/lib/cradle-live/types";
import { Panel, Empty, clock } from "./board-panels";
import s from "./cradle-live-board.module.css";

function position(trip: LiveTrip) {
  return trip.lat != null && trip.lng != null && isValidGeoPoint({ lat: trip.lat, lng: trip.lng })
    ? { lat: trip.lat, lng: trip.lng }
    : null;
}
function gps(trip: LiveTrip, now: number) {
  const point = position(trip);
  return classifyDriverLocation(
    point && trip.lastLocationAt
      ? { ...point, recordedAt: trip.lastLocationAt, accuracyMeters: trip.accuracyMeters }
      : null,
    { nowMs: now }
  );
}

const RoadMap = memo(function RoadMap({
  trips,
  selectedId,
  onSelect,
  path,
  fixture,
}: {
  trips: LiveTrip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  path: string | null;
  fixture: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const focused = useRef<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null),
    [error, setError] = useState(false);
  const key = fixture ? undefined : process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  useEffect(() => {
    if (!key) return;
    let active = true;
    loadGoogleMaps(key)
      .then(() => {
        if (active && container.current)
          setMap(
            new google.maps.Map(container.current, {
              center: { lat: 10.6765, lng: 122.9509 },
              zoom: 13,
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: "cooperative",
            })
          );
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!map) return;
    const keep = new Set<string>(),
      bounds = new google.maps.LatLngBounds();
    for (const trip of trips) {
      const driver = position(trip);
      for (const [kind, point] of [
        ["driver", driver],
        ["destination", trip.destinationPoint],
      ] as const) {
        if (!point || !isValidGeoPoint(point)) continue;
        const id = kind + ":" + trip.id;
        keep.add(id);
        let marker = markers.current.get(id);
        if (!marker) {
          marker = new google.maps.Marker({
            map,
            title: kind === "driver" ? (trip.driver ?? "Driver") : "Service destination",
          });
          marker.addListener("click", () => onSelect(trip.id));
          markers.current.set(id, marker);
        }
        marker.setPosition(point);
        const selected = selectedId === trip.id;
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 9 : 6,
          fillColor: kind === "driver" ? "#165e43" : "#bc8b12",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        });
        if (!selectedId || selected) bounds.extend(point);
      }
    }
    for (const [id, marker] of markers.current)
      if (!keep.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
      }
    const focus = selectedId ?? "overview";
    if (!bounds.isEmpty() && focused.current !== focus) {
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
      } else map.fitBounds(bounds, 50);
      focused.current = focus;
    }
  }, [map, trips, selectedId, onSelect]);
  useEffect(() => {
    if (!map || !path) return;
    const points = decodeEncodedPolyline(path);
    if (points.length < 2) return;
    const dash = {
      icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
      offset: "0px",
      repeat: "20px",
    };
    const line = new google.maps.Polyline({
      map,
      path: points,
      strokeColor: "#176349",
      strokeWeight: 3,
      strokeOpacity: 0.65,
      icons: [dash],
    });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let offset = 0;
    const timer = window.setInterval(() => {
      if (!motion.matches && !document.hidden)
        line.set("icons", [{ ...dash, offset: (++offset % 20) + "px" }]);
    }, 120);
    return () => {
      clearInterval(timer);
      line.setMap(null);
    };
  }, [map, path]);
  return (
    <>
      <div className={s.mapCanvas} ref={container} />
      {(!key || error || !map) && (
        <div className={s.mapFallback}>
          <MapPin size={26} />
          <strong>{key && !error ? "Connecting to Google Maps" : "Map unavailable"}</strong>
          <small>
            {fixture
              ? "Sample view · no live GPS"
              : !key
                ? "Google Maps is not configured"
                : error
                  ? "Google Maps could not load"
                  : "Waiting for map tiles"}
          </small>
        </div>
      )}
    </>
  );
});

const noTrips: LiveTrip[] = [];
export function Dispatch({ data, now }: { data: LiveBoardData; now: number }) {
  const trips = data.trips ?? noTrips;
  const [choice, choose] = useState<string | null>(null);
  const selected = trips.find((t) => t.id === choice) ?? trips[0];
  const [route, setRoute] = useState<RouteCacheEntry | null>(null);
  const cache = useRef(new Map<string, RouteCacheEntry>());
  const driver = selected?.id,
    routeKey = selected?.routeKey,
    point = useMemo(() => (selected ? position(selected) : null), [selected]);
  const reliable = selected ? gps(selected, now).isLive : false;
  useEffect(() => {
    if (
      data.scenario === "fixture" ||
      !data.branchId ||
      !driver ||
      !routeKey ||
      !point ||
      !reliable
    )
      return;
    let active = true;
    const previous = cache.current.get(driver);
    if (previous && !shouldRecomputeDriverRoute(previous, { routeKey, origin: point })) {
      setRoute(previous);
      return;
    }
    setRoute(null);
    getCrmDriverRouteAction({
      expectedBranchId: data.branchId,
      driverId: driver,
      date: data.businessDate,
    })
      .then((result) => {
        if (!active || !result.ok || result.routeKey !== routeKey || result.basis !== "routes_api")
          return;
        const entry = { ...result, origin: point, computedAtMs: Date.parse(result.computedAt) };
        cache.current.set(driver, entry);
        setRoute(entry);
      })
      .catch(() => {
        if (active) setRoute(null);
      });
    return () => {
      active = false;
    };
  }, [
    data.branchId,
    data.businessDate,
    data.scenario,
    data.refreshedAt,
    driver,
    routeKey,
    point,
    reliable,
  ]);
  const valid =
    route &&
    route.routeKey === routeKey &&
    reliable &&
    now - route.computedAtMs < ROUTE_CACHE_TTL_MS
      ? route
      : null;
  return (
    <Panel
      title="Home-service dispatch"
      href="/crm/dispatch?view=map"
      detail={
        <>
          <i className={s.dot} /> driverã€€
          <b className={s.goldDot} /> destination
        </>
      }
    >
      <p className={s.sub}>
        {data.trips ? trips.length + " driver assignments" : "Dispatch feed unavailable"}
      </p>
      <div className={s.map}>
        <RoadMap
          trips={trips}
          selectedId={selected?.id ?? null}
          onSelect={choose}
          path={valid?.encodedPolyline ?? null}
          fixture={data.scenario === "fixture"}
        />
        <div className={s.tripList}>
          {trips.map((t) => {
            const quality = gps(t, now),
              selectedRow = t.id === selected?.id;
            return (
              <div key={t.id} className={s.trip} data-selected={selectedRow}>
                <button
                  onClick={() => choose(t.id)}
                  aria-label={`Select ${t.driver ?? "unassigned driver"}: ${t.status}`}
                  aria-pressed={selectedRow}
                >
                  <span className={s.line}>
                    <strong>{t.driver ?? "Driver unassigned"}</strong>
                    <em>{t.status.replaceAll("_", " ")}</em>
                  </span>
                  <small>Therapist · {t.therapist ?? "Unavailable"}</small>
                  <small>{t.destination ?? "Service destination"}</small>
                  <span className={s.line}>
                    <small>
                      {quality.badgeText}
                      {quality.ageMinutes != null && " · " + quality.ageMinutes + "m ago"}
                    </small>
                    <small>
                      {selectedRow && valid?.estimatedArrivalIso
                        ? "Route end ETA " + clock(valid.estimatedArrivalIso)
                        : "ETA unavailable"}
                    </small>
                  </span>
                </button>
                {selectedRow && (
                  <div className={s.line}>
                    <small>{valid?.encodedPolyline ? "Road route" : "Route unavailable"}</small>
                    <Link
                      prefetch={false}
                      href={
                        "/crm/dispatch?view=map" +
                        (t.bookingId ? "&bookingId=" + encodeURIComponent(t.bookingId) : "")
                      }
                    >
                      Dispatch ↗
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
          {!trips.length && (
            <Empty>{data.trips ? "No active driver assignments" : "Trip list unavailable"}</Empty>
          )}
        </div>
      </div>
    </Panel>
  );
}
