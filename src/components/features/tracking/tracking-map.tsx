"use client";

import { useEffect, useRef, useState } from "react";

const MAPS_SCRIPT_ID = "google-maps-tracking";

function loadMapsApi(apiKey: string): void {
  if (document.getElementById(MAPS_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = MAPS_SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
  script.async = true;
  document.head.appendChild(script);
}

type Props = {
  driverLat: number | null;
  driverLng: number | null;
  destLat?: number | null;
  destLng?: number | null;
  destAddress?: string | null;
};

export function TrackingMap({ driverLat, driverLng, destLat, destLng, destAddress }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverMarkerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);

  // Load script and wait for API
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

  // Initialize or update map when API ready and location is available
  useEffect(() => {
    if (!apiReady || !mapContainerRef.current || driverLat === null || driverLng === null) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google.maps;
    const center = { lat: driverLat, lng: driverLng };

    if (!mapRef.current) {
      mapRef.current = new g.Map(mapContainerRef.current, {
        center,
        zoom: 15,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        disableDefaultUI: false,
      });

      driverMarkerRef.current = new g.Marker({
        position: center,
        map: mapRef.current,
        title: "Therapist location",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon: (g as any).Icon ? undefined : {
          url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });

      if (destLat != null && destLng != null) {
        new g.Marker({
          position: { lat: destLat, lng: destLng },
          map: mapRef.current,
          title: destAddress ?? "Your address",
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          },
        });

        // Fit bounds to show both markers
        const bounds = new g.LatLngBounds();
        bounds.extend(center);
        bounds.extend({ lat: destLat, lng: destLng });
        mapRef.current.fitBounds(bounds, 60);
      }
    } else {
      // Update driver marker position
      mapRef.current.setCenter(center);
      driverMarkerRef.current?.setPosition(center);
    }
  }, [apiReady, driverLat, driverLng, destLat, destLng, destAddress]);

  // No API key → fallback to Google Maps link
  if (!apiKey) {
    if (driverLat !== null && driverLng !== null) {
      return (
        <div style={containerStyle}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${driverLat},${driverLng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#163A2B", fontWeight: 600, fontSize: "0.875rem" }}
          >
            📍 View driver location on Google Maps →
          </a>
        </div>
      );
    }
    return <NoLocationState destLat={destLat} destLng={destLng} />;
  }

  // No location yet
  if (driverLat === null || driverLng === null) {
    return <NoLocationState destLat={destLat} destLng={destLng} />;
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        ...containerStyle,
        background: "#E8E8E8",
        position: "relative",
      }}
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

function NoLocationState({
  destLat,
  destLng,
}: {
  destLat?: number | null;
  destLng?: number | null;
}) {
  return (
    <div
      style={{
        ...containerStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        background: "#FFFDF7",
        border: "1px dashed #D4C9A8",
      }}
    >
      <span style={{ fontSize: "2rem" }}>📍</span>
      <p style={{ fontSize: "0.875rem", color: "#6B7A6F", textAlign: "center", margin: 0 }}>
        Location has not been shared yet.
        <br />
        Please check again shortly.
      </p>
      {destLat != null && destLng != null && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.8125rem", color: "#163A2B", fontWeight: 600, marginTop: "0.25rem" }}
        >
          View your address on Maps →
        </a>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: 280,
  borderRadius: 12,
  overflow: "hidden",
};
