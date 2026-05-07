"use client";

import { useEffect, useRef, useCallback } from "react";

export type PlaceSelectResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceSelectResult | null) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

const MAPS_SCRIPT_ID = "google-maps-places-api";

function loadMapsApi(apiKey: string): void {
  if (document.getElementById(MAPS_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = MAPS_SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
  script.async = true;
  document.head.appendChild(script);
}

// Renders a Google Places Autocomplete input when NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
// is set; otherwise behaves as a plain controlled text input.
export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing your address...",
  className = "",
  id,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || autocompleteRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;

    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ph" },
      fields: ["formatted_address", "geometry", "place_id"],
      types: ["geocode"],
    });

    ac.addListener("place_changed", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const place: any = ac.getPlace();
      if (!place.geometry?.location) {
        onPlaceSelect(null);
        return;
      }
      const lat: number = place.geometry.location.lat();
      const lng: number = place.geometry.location.lng();
      const formattedAddress: string = place.formatted_address ?? "";
      const placeId: string = place.place_id ?? "";
      onChange(formattedAddress);
      onPlaceSelect({ formattedAddress, lat, lng, placeId });
    });

    autocompleteRef.current = ac;
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    if (!apiKey) return;

    loadMapsApi(apiKey);

    // Poll until google.maps.places is ready (async script)
    let attempts = 0;
    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps?.places?.Autocomplete) {
        clearInterval(interval);
        initAutocomplete();
      }
      if (++attempts > 60) clearInterval(interval); // give up after ~30 s
    }, 500);

    return () => clearInterval(interval);
  }, [apiKey, initAutocomplete]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        // Manual edit clears any previously geocoded data
        onPlaceSelect(null);
      }}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
