"use client";

import { useId, useState } from "react";
import { ImageIcon, Info, Plus, Trash2 } from "lucide-react";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import {
  UniversalMediaPicker,
  type SelectedMediaValue,
} from "@/components/features/marketing/media/universal-media-picker";
import { LinkPicker } from "./link-picker";

export type SectionFormValues = {
  sectionKey: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  secondaryImageUrl: string;
  altText: string;
  linkHref: string;
  sortOrder: number;
  isEnabled: boolean;
  metadata: Record<string, unknown>;
};

export type StaticSectionInfo = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  previewSummary: string;
};

export const STATIC_SECTION_DEFINITIONS: readonly StaticSectionInfo[] = [
  {
    key: "experience",
    title: "The Cradle Experience",
    subtitle: "A guided path from intention to appointment",
    description:
      "This section explains the 4-step guest booking journey (Setting → Treatment → Schedule → Confirmation). It is statically rendered by public theme components.",
    previewSummary: "4 step cards with icons and journey explanation.",
  },
  {
    key: "choose_setting",
    title: "Choose Your Setting",
    subtitle: "Come to the spa, or let the spa come to you",
    description:
      "Visual comparison cards for In-Spa vs Home Service experiences in Bacolod. Controlled by the core design layout.",
    previewSummary: "Dual In-Spa and Home Service presentation cards.",
  },
  {
    key: "trust_points",
    title: "Why Guests Choose Cradle",
    subtitle: "Trust and Care Standards",
    description:
      "Quick trust highlights covering therapist care, seamless booking, sanitized rooms, and central Bacolod locations.",
    previewSummary: "4 trust highlights with verification icons.",
  },
  {
    key: "team",
    title: "Wellness Team & Therapists",
    subtitle: "Skilled Care Practitioners",
    description:
      "Showcases therapist credentials and hospitality standards. Staff profiles are managed operationally in staff administration.",
    previewSummary: "Staff care standards and team philosophy.",
  },
  {
    key: "reasons",
    title: "Reasons Guests Visit",
    subtitle: "Tailored Care Moments",
    description:
      "Contextual treatment cards for post-workout recovery, quiet escape, couple retreats, and travel massage.",
    previewSummary: "4 lifestyle care scenario cards.",
  },
  {
    key: "contact_presentation",
    title: "Branch & Location Presentation",
    subtitle: "Contact & Hours",
    description:
      "Branch addresses, contact phone numbers, and operational hours are dynamically populated from the active branch catalog.",
    previewSummary: "Live branch contact details and location cards.",
  },
] as const;

export type SectionEditorProps = {
  sectionKey: string;
  values: SectionFormValues;
  onChange: (updated: SectionFormValues) => void;
  mediaAssets?: MarketingMediaAssetRow[];
  disabled?: boolean;
};

export function SectionEditor({
  sectionKey,
  values,
  onChange,
  mediaAssets = [],
  disabled = false,
}: SectionEditorProps) {
  const formId = useId();
  const [activePickerField, setActivePickerField] = useState<"primary" | "secondary" | null>(null);

  const staticSection = STATIC_SECTION_DEFINITIONS.find((s) => s.key === sectionKey);

  const updateField = <K extends keyof SectionFormValues>(
    field: K,
    value: SectionFormValues[K]
  ) => {
    onChange({ ...values, [field]: value });
  };

  const updateMetadataField = (key: string, value: unknown) => {
    const nextMeta = { ...(values.metadata || {}), [key]: value };
    onChange({ ...values, metadata: nextMeta });
  };

  const handleMediaSelect = (selected: SelectedMediaValue) => {
    if (activePickerField === "primary") {
      onChange({
        ...values,
        imageUrl: selected.publicUrl,
        altText: selected.altText || values.altText || selected.title || "",
      });
    } else if (activePickerField === "secondary") {
      onChange({
        ...values,
        secondaryImageUrl: selected.publicUrl,
      });
    }
    setActivePickerField(null);
  };

  // If this is a Category C Static Component
  if (staticSection) {
    return (
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--cs-border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                Static / Not Managed Here
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--cs-text)]">
              {staticSection.title}
            </h2>
            <p className="text-xs text-[var(--cs-text-secondary)]">{staticSection.subtitle}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-[var(--cs-surface-warm)] p-4 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
            <div className="flex items-start gap-2.5">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-text-secondary)]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-[var(--cs-text)]">
                  Informational Preview Component
                </p>
                <p className="mt-1">{staticSection.description}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--cs-border)] p-4 text-xs">
            <span className="font-semibold text-[var(--cs-text)]">Live Presentation Preview:</span>
            <p className="mt-1 text-[var(--cs-text-secondary)]">{staticSection.previewSummary}</p>
          </div>
        </div>
      </div>
    );
  }

  // Category B: Display Gates
  if (sectionKey === "gallery" || sectionKey === "signature_services") {
    const isServices = sectionKey === "signature_services";
    return (
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--cs-border)] pb-4">
          <div>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              Homepage Display Gate
            </span>
            <h2 className="mt-1.5 text-lg font-semibold text-[var(--cs-text)]">
              {isServices ? "Signature Services Catalog Presentation" : "Photo Gallery Showcase"}
            </h2>
            <p className="text-xs text-[var(--cs-text-secondary)]">
              {isServices
                ? "Controls the visibility and header banner for the services showcase on the homepage."
                : "Controls whether the photo gallery showcase appears on the public homepage."}
            </p>
          </div>

          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              disabled={disabled}
              checked={values.isEnabled}
              onChange={(e) => updateField("isEnabled", e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-stone-200 peer-checked:bg-[var(--cs-primary)] peer-focus:ring-2 peer-focus:ring-[var(--cs-primary)] peer-focus:outline-none dark:bg-stone-700" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-full" />
            <span className="ml-3 text-xs font-semibold text-[var(--cs-text)]">
              {values.isEnabled ? "Visible on Homepage" : "Hidden"}
            </span>
          </label>
        </div>

        {isServices && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor={`${formId}-title`}
                className="block text-xs font-semibold text-[var(--cs-text)]"
              >
                Banner Headline
              </label>
              <input
                id={`${formId}-title`}
                type="text"
                disabled={disabled}
                value={values.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-subtitle`}
                className="block text-xs font-semibold text-[var(--cs-text)]"
              >
                Section Eyebrow
              </label>
              <input
                id={`${formId}-subtitle`}
                type="text"
                disabled={disabled}
                value={values.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-body`}
                className="block text-xs font-semibold text-[var(--cs-text)]"
              >
                Introduction Copy
              </label>
              <textarea
                id={`${formId}-body`}
                rows={3}
                disabled={disabled}
                value={values.body}
                onChange={(e) => updateField("body", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
              />
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-semibold">Operational Catalog Boundary</p>
              <p className="mt-0.5">
                Service rates, durations, and booking options are protected operational fields
                managed in Service Administration.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Category A: Managed Sections (Hero, About, Quote Banner, Before You Book)
  const items = Array.isArray(values.metadata?.items) ? (values.metadata.items as string[]) : [];

  const handleAddItem = () => {
    updateMetadataField("items", [...items, ""]);
  };

  const handleUpdateItem = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = val;
    updateMetadataField("items", updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    updateMetadataField("items", updated);
  };

  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-xs space-y-6">
      {/* Header & Visibility Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--cs-border)] pb-4">
        <div>
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            Managed Section Draft
          </span>
          <h2 className="mt-1 text-lg font-semibold text-[var(--cs-text)]">
            {sectionKey === "hero"
              ? "Hero Section"
              : sectionKey === "about"
                ? "About & Spa Philosophy"
                : sectionKey === "quote_banner"
                  ? "Promotional Quote Banner"
                  : "Before You Book Guide"}
          </h2>
        </div>

        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            disabled={disabled}
            checked={values.isEnabled}
            onChange={(e) => updateField("isEnabled", e.target.checked)}
            className="peer sr-only"
          />
          <div className="peer h-6 w-11 rounded-full bg-stone-200 peer-checked:bg-[var(--cs-primary)] peer-focus:ring-2 peer-focus:ring-[var(--cs-primary)] peer-focus:outline-none dark:bg-stone-700" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-full" />
          <span className="ml-3 text-xs font-semibold text-[var(--cs-text)]">
            {values.isEnabled ? "Section Active" : "Section Disabled"}
          </span>
        </label>
      </div>

      {/* Main Copy Fields */}
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor={`${formId}-title`}
            className="block text-xs font-semibold text-[var(--cs-text)]"
          >
            Main Title / Headline
          </label>
          <input
            id={`${formId}-title`}
            type="text"
            disabled={disabled}
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
            placeholder="e.g. Restore Your Body. Quiet Your Mind."
          />
        </div>

        {/* Subtitle / Eyebrow */}
        <div>
          <label
            htmlFor={`${formId}-subtitle`}
            className="block text-xs font-semibold text-[var(--cs-text)]"
          >
            {sectionKey === "hero" ? "Subtitle / Supporting Paragraph" : "Eyebrow / Subtitle"}
          </label>
          {sectionKey === "hero" ? (
            <textarea
              id={`${formId}-subtitle`}
              rows={3}
              disabled={disabled}
              value={values.subtitle}
              onChange={(e) => updateField("subtitle", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
            />
          ) : (
            <input
              id={`${formId}-subtitle`}
              type="text"
              disabled={disabled}
              value={values.subtitle}
              onChange={(e) => updateField("subtitle", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
            />
          )}
        </div>

        {/* Body (for About, Banner, Before You Book) */}
        {sectionKey !== "hero" && (
          <div>
            <label
              htmlFor={`${formId}-body`}
              className="block text-xs font-semibold text-[var(--cs-text)]"
            >
              {sectionKey === "about"
                ? "Philosophy Copy (Separate paragraphs with a blank line)"
                : sectionKey === "quote_banner"
                  ? "Secondary Banner Text (Optional)"
                  : "Introductory Note"}
            </label>
            <textarea
              id={`${formId}-body`}
              rows={4}
              disabled={disabled}
              value={values.body}
              onChange={(e) => updateField("body", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
            />
          </div>
        )}

        {/* CTAs (Hero, Quote Banner) */}
        {(sectionKey === "hero" || sectionKey === "quote_banner") && (
          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4">
            <div>
              <label
                htmlFor={`${formId}-ctaLabel`}
                className="block text-xs font-semibold text-[var(--cs-text)]"
              >
                Primary Button Text
              </label>
              <input
                id={`${formId}-ctaLabel`}
                type="text"
                disabled={disabled}
                value={values.ctaLabel}
                onChange={(e) => updateField("ctaLabel", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
                placeholder="e.g. Book Appointment"
              />
            </div>

            <LinkPicker
              label="Primary Button Destination"
              value={values.ctaHref || "/book"}
              disabled={disabled}
              onChange={(href) => updateField("ctaHref", href)}
            />

            {sectionKey === "hero" && (
              <>
                <div>
                  <label
                    htmlFor={`${formId}-secCtaLabel`}
                    className="block text-xs font-semibold text-[var(--cs-text)]"
                  >
                    Secondary Button Text
                  </label>
                  <input
                    id={`${formId}-secCtaLabel`}
                    type="text"
                    disabled={disabled}
                    value={String(values.metadata?.secondaryCtaLabel ?? "")}
                    onChange={(e) => updateMetadataField("secondaryCtaLabel", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
                    placeholder="e.g. Plan Your Visit"
                  />
                </div>

                <LinkPicker
                  label="Secondary Button Destination"
                  value={String(values.metadata?.secondaryCtaHref ?? "#plan-your-visit")}
                  disabled={disabled}
                  onChange={(href) => updateMetadataField("secondaryCtaHref", href)}
                />
              </>
            )}
          </div>
        )}

        {/* Before You Book Checklist Items */}
        {sectionKey === "before_you_book" && (
          <div className="space-y-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--cs-text)]">
                Booking Guidelines Checklist Items
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cs-primary)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[10px] font-bold text-[var(--cs-text-secondary)]">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    disabled={disabled}
                    value={item}
                    onChange={(e) => handleUpdateItem(index, e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:ring-1 focus:ring-[var(--cs-primary)]"
                    placeholder="Guideline point..."
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveItem(index)}
                    className="p-1 text-stone-400 hover:text-red-600 focus:outline-none"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-[var(--cs-text-secondary)] italic">
                  No custom checklist items specified. Standard guidelines will be displayed.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Media / Imagery Controls */}
        {sectionKey !== "before_you_book" && (
          <div className="space-y-4 border-t border-[var(--cs-border)] pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Section Imagery
            </h3>

            {/* Primary Image */}
            <div className="rounded-lg border border-[var(--cs-border)] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--cs-text)]">
                  {sectionKey === "hero" ? "Desktop Background Image" : "Primary Showcase Image"}
                </span>
                {values.imageUrl && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => updateField("imageUrl", "")}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {values.imageUrl ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border)] bg-stone-100">
                    <img
                      src={values.imageUrl}
                      alt={values.altText || "Section primary image preview"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--cs-text)]">
                      {values.imageUrl}
                    </p>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setActivePickerField("primary")}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                    >
                      <ImageIcon className="h-3 w-3" />
                      Change Image
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setActivePickerField("primary")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--cs-border)] p-4 text-xs font-semibold text-[var(--cs-primary)] transition hover:bg-[var(--cs-surface-warm)]"
                >
                  <ImageIcon className="h-4 w-4" />
                  Choose from Media Library
                </button>
              )}
            </div>

            {/* Secondary Image (Hero / About) */}
            {(sectionKey === "hero" || sectionKey === "about") && (
              <div className="rounded-lg border border-[var(--cs-border)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--cs-text)]">
                    {sectionKey === "hero"
                      ? "Feature Portrait Image"
                      : "Secondary Atmosphere Image"}
                  </span>
                  {values.secondaryImageUrl && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateField("secondaryImageUrl", "")}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {values.secondaryImageUrl ? (
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border)] bg-stone-100">
                      <img
                        src={values.secondaryImageUrl}
                        alt="Secondary image preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--cs-text)]">
                        {values.secondaryImageUrl}
                      </p>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setActivePickerField("secondary")}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Change Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setActivePickerField("secondary")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--cs-border)] p-4 text-xs font-semibold text-[var(--cs-primary)] transition hover:bg-[var(--cs-surface-warm)]"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Choose Secondary Image
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Universal Media Picker Modal */}
      {activePickerField && (
        <UniversalMediaPicker
          isOpen={Boolean(activePickerField)}
          onClose={() => setActivePickerField(null)}
          onSelect={handleMediaSelect}
          currentUrl={activePickerField === "primary" ? values.imageUrl : values.secondaryImageUrl}
          title={
            activePickerField === "primary"
              ? `Select Primary Image for ${values.title || "Section"}`
              : `Select Secondary Image for ${values.title || "Section"}`
          }
          availableAssets={mediaAssets}
          filterSectionKey={sectionKey}
        />
      )}
    </div>
  );
}
