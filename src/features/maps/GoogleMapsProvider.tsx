"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import React from "react";

const API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ||
  "";

const HAS_KEY = API_KEY.length > 0;

/**
 * Reusable client-side provider for @vis.gl/react-google-maps.
 *
 * - Renders children inside APIProvider only when a key is present.
 * - Falls back to rendering children directly when the key is missing
 *   so the app never crashes during local dev, preview, or production.
 *
 * Wrap sections of the app that need Google Maps (e.g. dispatch center,
 * booking wizard location step) with this provider.
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
      libraries={["places"]}
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
