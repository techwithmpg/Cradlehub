"use client";

import { useId, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";

export type LinkDestinationOption = {
  label: string;
  href: string;
  category: "Pages" | "In-Page Anchors";
};

export const VERIFIED_PUBLIC_DESTINATIONS: readonly LinkDestinationOption[] = [
  { label: "Homepage (Top)", href: "/", category: "Pages" },
  { label: "Online Booking (/book)", href: "/book", category: "Pages" },
  { label: "Services Menu (/services)", href: "/services", category: "Pages" },
  { label: "Our Branches (/branches)", href: "/branches", category: "Pages" },
  { label: "About Cradle (/about)", href: "/about", category: "Pages" },
  { label: "Contact Us (/contact)", href: "/contact", category: "Pages" },
  { label: "Wellness Products (/products)", href: "/products", category: "Pages" },
  {
    label: "Home Service Bacolod (/home-service-massage-bacolod)",
    href: "/home-service-massage-bacolod",
    category: "Pages",
  },
  {
    label: "Massage Spa Bacolod (/massage-spa-bacolod)",
    href: "/massage-spa-bacolod",
    category: "Pages",
  },
  {
    label: "Anchor: Plan Your Visit (#plan-your-visit)",
    href: "#plan-your-visit",
    category: "In-Page Anchors",
  },
  {
    label: "Anchor: Spa Philosophy (#philosophy)",
    href: "#philosophy",
    category: "In-Page Anchors",
  },
  {
    label: "Anchor: Experience Journey (#experience)",
    href: "#experience",
    category: "In-Page Anchors",
  },
] as const;

export type LinkPickerProps = {
  value: string;
  onChange: (href: string) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
};

export function isValidExternalUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function LinkPicker({
  value,
  onChange,
  label = "Button Destination",
  id,
  disabled = false,
}: LinkPickerProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const isKnownDestination = VERIFIED_PUBLIC_DESTINATIONS.some((d) => d.href === value);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    !isKnownDestination && Boolean(value.trim())
  );
  const [customUrl, setCustomUrl] = useState<string>(value);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === "__custom__") {
      setIsCustomMode(true);
      setCustomUrl(value);
      setUrlError(null);
    } else {
      setIsCustomMode(false);
      setUrlError(null);
      onChange(selected);
    }
  };

  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomUrl(raw);

    if (!raw.trim()) {
      setUrlError(null);
      onChange("");
      return;
    }

    if (raw.startsWith("/") || raw.startsWith("#")) {
      setUrlError(null);
      onChange(raw);
      return;
    }

    if (raw.toLowerCase().startsWith("javascript:") || raw.toLowerCase().startsWith("data:")) {
      setUrlError("Unsafe URL scheme is not allowed.");
      return;
    }

    if (isValidExternalUrl(raw)) {
      setUrlError(null);
      onChange(raw);
    } else {
      setUrlError("Must be a valid web address starting with https:// or http://");
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="block text-xs font-semibold text-[var(--cs-text)]">
          {label}
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const nextMode = !isCustomMode;
            setIsCustomMode(nextMode);
            setUrlError(null);
            if (!nextMode && !isKnownDestination) {
              onChange("/book");
            }
          }}
          className="text-[11px] font-medium text-[var(--cs-primary)] hover:underline focus:outline-none"
        >
          {isCustomMode ? "Choose from standard routes" : "Enter custom URL"}
        </button>
      </div>

      {!isCustomMode ? (
        <div className="relative">
          <select
            id={fieldId}
            disabled={disabled}
            value={isKnownDestination ? value : "__custom__"}
            onChange={handleSelectChange}
            className="w-full appearance-none rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)] disabled:opacity-50"
          >
            <optgroup label="Public Pages">
              {VERIFIED_PUBLIC_DESTINATIONS.filter((d) => d.category === "Pages").map((d) => (
                <option key={d.href} value={d.href}>
                  {d.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="In-Page Anchors">
              {VERIFIED_PUBLIC_DESTINATIONS.filter((d) => d.category === "In-Page Anchors").map(
                (d) => (
                  <option key={d.href} value={d.href}>
                    {d.label}
                  </option>
                )
              )}
            </optgroup>
            <option value="__custom__">Custom URL...</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--cs-text-secondary)]">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <input
              id={fieldId}
              type="text"
              disabled={disabled}
              placeholder="https://example.com or /custom-path"
              value={customUrl}
              onChange={handleCustomUrlChange}
              className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 pl-8 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)] disabled:opacity-50"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[var(--cs-text-secondary)]">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          {urlError ? (
            <p className="text-[11px] font-medium text-red-600" role="alert">
              {urlError}
            </p>
          ) : (
            <p className="text-[11px] text-[var(--cs-text-secondary)]">
              Standard web addresses (https://...) or internal paths (/path).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
