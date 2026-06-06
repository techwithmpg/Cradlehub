"use client";

import { useEffect, useRef } from "react";

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type PlaceSelectResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
  addressComponents: GoogleAddressComponent[];
  mapUrl: string;
  source: "google_places";
};

export type PlacesAutocompleteStatus =
  | "idle"
  | "missing_key"
  | "loading"
  | "ready"
  | "failed"
  | "place_missing_coordinates";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceSelectResult | null) => void;
  onStatusChange?: (status: PlacesAutocompleteStatus) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaDescribedBy?: string;
  theme?: "default" | "warm";
};

const MAPS_SCRIPT_ID = "google-maps-api";

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (libraryName: "places") => Promise<GooglePlacesLibrary>;
    };
  };
};

type GooglePlacesLibrary = {
  PlaceAutocompleteElement: new (
    options: GooglePlaceAutocompleteElementOptions
  ) => GooglePlaceAutocompleteElement;
};

type GooglePlaceAutocompleteElementOptions = {
  includedRegionCodes?: string[];
  requestedLanguage?: string;
  requestedRegion?: string;
};

type GooglePlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes?: string[];
  placeholder?: string;
  requestedLanguage?: string;
  requestedRegion?: string;
  value?: string;
};

type GooglePlacePrediction = {
  toPlace: () => GooglePlace;
};

type GooglePlaceSelectEvent = Event & {
  placePrediction?: GooglePlacePrediction;
  detail?: {
    placePrediction?: GooglePlacePrediction;
  };
};

type GooglePlace = {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  googleMapsURI?: string;
  addressComponents?: GooglePlaceAddressComponent[];
  location?: GoogleLatLng;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type GooglePlaceAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleLatLng =
  | {
      lat: () => number;
      lng: () => number;
    }
  | {
      lat: number;
      lng: number;
    };

let mapsApiPromise: Promise<void> | null = null;
let placesLibraryPromise: Promise<GooglePlacesLibrary> | null = null;

function hasMapsImportLibrary(): boolean {
  return Boolean(((window as unknown) as GoogleMapsWindow).google?.maps?.importLibrary);
}

function buildMapsUrl(lat: number, lng: number, placeId: string): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${lat},${lng}`,
  });

  if (placeId) {
    params.set("query_place_id", placeId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function loadMapsApi(apiKey: string): Promise<void> {
  if (hasMapsImportLibrary()) return Promise.resolve();
  if (mapsApiPromise) return mapsApiPromise;

  const staleLegacyScript = document.getElementById("google-maps-places-api");
  if (staleLegacyScript) {
    staleLegacyScript.remove();
  }

  let script = document.getElementById(MAPS_SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    document.head.appendChild(script);
  }

  mapsApiPromise = new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = window.setInterval(() => {
      if (hasMapsImportLibrary()) {
        window.clearInterval(interval);
        resolve();
        return;
      }

      attempts += 1;
      if (attempts > maxAttempts) {
        window.clearInterval(interval);
        mapsApiPromise = null;
        reject(new Error("Google Maps JavaScript API did not load."));
      }
    }, 500);

    script.addEventListener(
      "error",
      () => {
        window.clearInterval(interval);
        mapsApiPromise = null;
        reject(new Error("Google Maps JavaScript API failed to load."));
      },
      { once: true }
    );
  });

  return mapsApiPromise;
}

async function loadPlacesLibrary(apiKey: string): Promise<GooglePlacesLibrary> {
  if (placesLibraryPromise) return placesLibraryPromise;

  placesLibraryPromise = loadMapsApi(apiKey)
    .then(async () => {
      const importLibrary = ((window as unknown) as GoogleMapsWindow).google?.maps?.importLibrary;
      if (!importLibrary) {
        placesLibraryPromise = null;
        throw new Error("Google Maps importLibrary is unavailable.");
      }

      return importLibrary("places");
    })
    .catch((error: unknown) => {
      placesLibraryPromise = null;
      throw error;
    });

  return placesLibraryPromise;
}

function getEventPlacePrediction(event: Event): GooglePlacePrediction | null {
  const selectEvent = event as GooglePlaceSelectEvent;
  return selectEvent.placePrediction ?? selectEvent.detail?.placePrediction ?? null;
}

function readLatLng(location: GoogleLatLng): { lat: number; lng: number } {
  const lat = typeof location.lat === "function" ? location.lat() : location.lat;
  const lng = typeof location.lng === "function" ? location.lng() : location.lng;
  return { lat, lng };
}

function normalizeAddressComponents(
  components: GooglePlaceAddressComponent[] | undefined
): GoogleAddressComponent[] {
  return (components ?? []).map((component) => ({
    long_name: component.longText ?? "",
    short_name: component.shortText ?? component.longText ?? "",
    types: component.types ?? [],
  }));
}

function stylePlaceAutocompleteElement(
  element: GooglePlaceAutocompleteElement,
  theme: Props["theme"]
): void {
  const isWarm = theme === "warm";

  element.style.display = "block";
  element.style.width = "100%";
  element.style.setProperty(
    "border",
    isWarm ? "1px solid rgba(212, 181, 122, 0.25)" : "1px solid #EDE4D3"
  );
  element.style.setProperty("border-radius", "0.75rem");
  element.style.setProperty(
    "background-color",
    isWarm ? "rgba(5, 36, 29, 0.75)" : "#FFFFFF"
  );
  element.style.setProperty("color", isWarm ? "#F6EBD6" : "#163A2B");
  element.style.setProperty(
    "box-shadow",
    isWarm ? "inset 0 1px 0 rgba(246,235,214,0.06)" : "none"
  );
  element.style.setProperty("caret-color", isWarm ? "#D4B57A" : "#163A2B");
  element.style.setProperty("color-scheme", isWarm ? "dark" : "light");
  element.style.setProperty("font-family", "inherit");
  element.style.setProperty("font-size", "14px");
  element.style.setProperty("line-height", "1.5");
}

// Renders the new Places API widget when NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is set.
export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  onStatusChange,
  placeholder = "Start typing your address...",
  className = "",
  id,
  ariaDescribedBy,
  theme = "default",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<GooglePlaceAutocompleteElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onStatusChangeRef = useRef(onStatusChange);
  const valueRef = useRef(value);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectRef.current = onPlaceSelect;
    onStatusChangeRef.current = onStatusChange;
    valueRef.current = value;
  }, [onChange, onPlaceSelect, onStatusChange, value]);

  useEffect(() => {
    let cancelled = false;
    let autocompleteElement: GooglePlaceAutocompleteElement | null = null;
    let hostElement: HTMLDivElement | null = null;

    if (!apiKey) {
      onStatusChangeRef.current?.("missing_key");
      return;
    }

    onStatusChangeRef.current?.("loading");
    loadPlacesLibrary(apiKey)
      .then(({ PlaceAutocompleteElement }) => {
        hostElement = hostRef.current;
        if (cancelled || !hostElement) return;

        autocompleteElement = new PlaceAutocompleteElement({
          includedRegionCodes: ["ph"],
          requestedLanguage: "en",
          requestedRegion: "ph",
        });
        autocompleteElement.placeholder = placeholder;
        autocompleteElement.value = valueRef.current;
        autocompleteElement.className = className;
        if (id) autocompleteElement.id = id;
        if (ariaDescribedBy) {
          autocompleteElement.setAttribute("aria-describedby", ariaDescribedBy);
        }
        stylePlaceAutocompleteElement(autocompleteElement, theme);

        const handleInput = () => {
          onChangeRef.current(autocompleteElement?.value ?? "");
          onPlaceSelectRef.current(null);
        };

        const handleError = () => {
          onPlaceSelectRef.current(null);
          onStatusChangeRef.current?.("failed");
        };

        const handleSelect = async (event: Event) => {
          const placePrediction = getEventPlacePrediction(event);
          if (!placePrediction) {
            onPlaceSelectRef.current(null);
            onStatusChangeRef.current?.("failed");
            return;
          }

          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: [
                "id",
                "displayName",
                "formattedAddress",
                "location",
                "addressComponents",
                "googleMapsURI",
              ],
            });

            if (!place.location) {
              onPlaceSelectRef.current(null);
              onStatusChangeRef.current?.("place_missing_coordinates");
              return;
            }

            const { lat, lng } = readLatLng(place.location);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              onPlaceSelectRef.current(null);
              onStatusChangeRef.current?.("place_missing_coordinates");
              return;
            }

            const formattedAddress =
              place.formattedAddress ?? place.displayName ?? autocompleteElement?.value ?? "";
            const placeId = place.id ?? "";

            onChangeRef.current(formattedAddress);
            onPlaceSelectRef.current({
              formattedAddress,
              lat,
              lng,
              placeId,
              addressComponents: normalizeAddressComponents(place.addressComponents),
              mapUrl: place.googleMapsURI ?? buildMapsUrl(lat, lng, placeId),
              source: "google_places",
            });
            onStatusChangeRef.current?.("ready");
          } catch {
            onPlaceSelectRef.current(null);
            onStatusChangeRef.current?.("failed");
          }
        };

        autocompleteElement.addEventListener("input", handleInput);
        autocompleteElement.addEventListener("gmp-error", handleError);
        autocompleteElement.addEventListener("gmp-select", handleSelect);
        hostElement.replaceChildren(autocompleteElement);
        autocompleteRef.current = autocompleteElement;
        onStatusChangeRef.current?.("ready");

        return () => {
          autocompleteElement?.removeEventListener("input", handleInput);
          autocompleteElement?.removeEventListener("gmp-error", handleError);
          autocompleteElement?.removeEventListener("gmp-select", handleSelect);
        };
      })
      .catch(() => {
        if (!cancelled) onStatusChangeRef.current?.("failed");
      });

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
      autocompleteElement?.remove();
      hostElement?.replaceChildren();
    };
  }, [
    apiKey,
    ariaDescribedBy,
    className,
    id,
    placeholder,
    theme,
  ]);

  useEffect(() => {
    if (autocompleteRef.current && autocompleteRef.current.value !== value) {
      autocompleteRef.current.value = value;
    }
  }, [value]);

  return <div ref={hostRef} />;
}
