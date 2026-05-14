"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import React from "react";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

const HAS_KEY = API_KEY.length > 0;

/**
 * Reusable client-side provider for map rendering with @vis.gl/react-google-maps.
 *
 * - Renders children inside APIProvider only when a key is present.
 * - Falls back to rendering children directly when the key is missing
 *   so the app never crashes during local dev, preview, or production.
 * - Does not request the legacy Places library; the booking wizard location
 *   field uses `google.maps.importLibrary("places")` in its own client widget.
 */
export function GoogleMapsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!HAS_KEY) {
    return <>{children}</>;
  }

  return (
    <APIProvider
      apiKey={API_KEY}
      version="weekly"
      language="en"
      region="PH"
    >
      {children}
    </APIProvider>
  );
}

/**
 * Hook to check whether Google Maps is enabled in the current environment.
 * Safe to call outside APIProvider.
 */
export function useGoogleMapsEnabled(): boolean {
  return HAS_KEY;
}
