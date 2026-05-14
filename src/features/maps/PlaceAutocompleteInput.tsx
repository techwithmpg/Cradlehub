"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlaceAutocompleteResult = {
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
};

export type PlaceAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (result: PlaceAutocompleteResult | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
};

const HAS_BROWSER_KEY = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

/**
 * Reusable location input that safely degrades when Google Maps is not configured.
 *
 * - When the API key is missing: renders a normal text input so the booking wizard
 *   and dispatch forms never break.
 * - When a browser key is present: callers should prefer the active
 *   `src/components/public/places-autocomplete.tsx` widget for Places API (New).
 */
export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search address, building, or landmark…",
  className,
  disabled,
  id,
  "aria-describedby": ariaDescribedBy,
}: PlaceAutocompleteInputProps) {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      // Clear any previously selected place when the user types freely.
      onPlaceSelect?.(null);
    },
    [onChange, onPlaceSelect]
  );

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        className="w-full"
      />
      {HAS_BROWSER_KEY && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/60">
          Maps ready
        </span>
      )}
    </div>
  );
}
