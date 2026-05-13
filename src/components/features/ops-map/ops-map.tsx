"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveTripData } from "@/lib/actions/live-ops-actions";

// Shares the same script tag as tracking-map.tsx — Google Maps SDK loads once per page.
const MAPS_SCRIPT_ID = "google-maps-tracking";
// Default center: Metro Manila
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

function loadMapsApi(apiKey: string): void {
  if (document.getElementById(MAPS_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = MAPS_SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
  script.async = true;
  document.head.appendChild(script);
}

type Props = { trips: ActiveTripData[] };

export function OpsMap({ trips }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destMarkersRef = useRef<any[]>([]);
  const [apiReady, setApiReady] = useState(false);

  // Load Maps API script and poll for readiness
  useEffect(() => {
    if (!apiKey) return;
    loadMapsApi(apiKey);
    let attempts = 0;
    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps?.Map) {
        setApiReady(true);
        clearInterval(interval);
      }
      if (++attempts > 80) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, [apiKey]);

  // Initialize map once, then update markers whenever trips change
  useEffect(() => {
    if (!apiReady || !mapContainerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google.maps;

    if (!mapRef.current) {
      mapRef.current = new g.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      });
    }

    // Clear existing markers
    for (const m of staffMarkersRef.current) m.setMap(null);
    for (const m of destMarkersRef.current) m.setMap(null);
    staffMarkersRef.current = [];
    destMarkersRef.current = [];

    const bounds = new g.LatLngBounds();
    let hasMarkers = false;

    for (const trip of trips) {
      if (trip.location) {
        const pos = { lat: trip.location.lat, lng: trip.location.lng };
        const marker = new g.Marker({
          position: pos,
          map: mapRef.current,
          title: trip.therapist_name ?? trip.driver_name ?? "Staff",
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
        });
        staffMarkersRef.current.push(marker);
        bounds.extend(pos);
        hasMarkers = true;
      }

      if (trip.dest_lat !== null && trip.dest_lng !== null) {
        const pos = { lat: trip.dest_lat, lng: trip.dest_lng };
        const marker = new g.Marker({
          position: pos,
          map: mapRef.current,
          title: trip.customer_name ?? "Customer destination",
          icon: { url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" },
        });
        destMarkersRef.current.push(marker);
        bounds.extend(pos);
        hasMarkers = true;
      }
    }

    if (hasMarkers && mapRef.current) {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [apiReady, trips]);

  if (!apiKey) {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFDF7", border: "1px dashed #D4C9A8" }}>
        <span style={{ fontSize: "0.875rem", color: "#9CA8A2" }}>
          Maps API key not configured.
        </span>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{ ...containerStyle, background: "#E8E8E8", position: "relative" }}
    >
      {!apiReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6B7A6F",
            fontSize: "0.875rem",
          }}
        >
          Loading map…
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: 440,
  borderRadius: 12,
  overflow: "hidden",
};
