"use client";

import { useState } from "react";
import { FileImage, Image as ImageIcon, Sparkles, X } from "lucide-react";
import {
  UniversalMediaPicker,
  type SelectedMediaValue,
} from "@/components/features/marketing/media/universal-media-picker";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import {
  getMediaContract,
  type MarketingMediaIntentKey,
} from "@/lib/marketing/media-contracts";

export type MarketingMediaFieldProps = {
  label: string;
  intent: MarketingMediaIntentKey;
  value: string;
  altValue?: string;
  onChange: (value: string, altText?: string) => void;
  availableAssets?: MarketingMediaAssetRow[];
  disabled?: boolean;
  helperText?: string;
  className?: string;
};

export function MarketingMediaField({
  label,
  intent,
  value,
  altValue = "",
  onChange,
  availableAssets = [],
  disabled = false,
  helperText,
  className = "",
}: MarketingMediaFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const contract = getMediaContract(intent);

  const isSvg = value.toLowerCase().endsWith(".svg");

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label className="text-xs font-semibold text-[var(--cs-text)]">{label}</label>
        <span className="text-[10px] font-medium text-[var(--cs-text-tertiary)] bg-[var(--cs-surface)] px-2 py-0.5 rounded-md border border-[var(--cs-border-subtle)]">
          {contract.id.replace(/_/g, " ")}
        </span>
      </div>

      {/* Requirement Banner */}
      <div className="flex items-start gap-1.5 rounded-lg border border-[#C8A96B]/20 bg-[#C8A96B]/5 px-2.5 py-1.5 text-[11px] text-[#8C6D23] dark:text-[#D4B57A]">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#C8A96B]" />
        <span>{contract.requirementText}</span>
      </div>

      {helperText && <p className="text-[11px] text-[var(--cs-text-secondary)]">{helperText}</p>}

      {/* Media Value / Selector Box */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3">
        {value ? (
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] flex items-center justify-center">
            {isSvg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={altValue || label} className="h-full w-full object-contain p-1" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={altValue || label} className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-tertiary)]">
            <FileImage className="h-6 w-6" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-xs font-medium text-[var(--cs-text)]">
            {value ? value.split("/").pop() : "No image selected"}
          </p>
          {value && (
            <p className="truncate text-[11px] text-[var(--cs-text-secondary)]">
              {value.startsWith("http") ? value : `Path: ${value}`}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
              {value ? "Change Asset" : "Choose Asset"}
            </button>

            {value && !disabled && (
              <button
                type="button"
                onClick={() => onChange("", "")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                aria-label={`Clear ${label}`}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {showPicker && (
        <UniversalMediaPicker
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(selected: SelectedMediaValue) => {
            onChange(selected.publicUrl, selected.altText);
            setShowPicker(false);
          }}
          currentUrl={value}
          title={`Select ${label}`}
          availableAssets={availableAssets}
          mediaIntent={intent}
        />
      )}
    </div>
  );
}
