"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckCircle,
  Eye,
  Laptop,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Smartphone,
} from "lucide-react";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type {
  MarketingBrandSettingRow,
  MarketingBrandSettingValue,
} from "@/lib/queries/marketing-brand";
import type { GeneratedSiteIconPackage } from "@/lib/marketing/icon-generator";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import {
  approveMarketingDraftAction,
  publishMarketingDraftAction,
  requestMarketingDraftChangesAction,
} from "@/app/(dashboard)/owner/marketing/actions";
import {
  generateSiteIconAction,
  updateBrandSettingAction,
} from "@/app/(dashboard)/marketing/brand-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarketingStudioPanel } from "@/components/features/marketing/shared/marketing-studio-panel";
import { MarketingFieldGroup } from "@/components/features/marketing/shared/marketing-field-group";
import { MarketingMediaField } from "@/components/features/marketing/shared/marketing-media-field";
import { MarketingActionBar } from "@/components/features/marketing/shared/marketing-action-bar";

export type BrandStudioViewProps = {
  role: "digital_marketer" | "owner";
  brandSettings: MarketingBrandSettingRow[];
  drafts?: MarketingContentDraftRow[];
  revisions?: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
};

type BrandFormValues = {
  headerLogoUrl: string;
  headerLogoAlt: string;
  footerLogoUrl: string;
  footerLogoAlt: string;
  brandMarkUrl: string;
  brandMarkAlt: string;
  siteIconMasterUrl: string;
  siteIconUrl: string;
  siteIconAlt: string;
  siteIconPackage: GeneratedSiteIconPackage | null;
  taglineText: string;
  taglineSubtext: string;
};

type ActionNoticeState = { success: boolean; message?: string; error?: string };

export function BrandStudioView({
  role,
  brandSettings,
  drafts = [],
  revisions = [],
  mediaAssets = [],
}: BrandStudioViewProps) {
  const initialNoticeState: ActionNoticeState = { success: true };

  // Action states
  const [saveState, saveAction, isSaving] = useActionState(
    saveMarketingDraftAction,
    initialNoticeState
  );
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitMarketingDraftAction,
    initialNoticeState
  );
  const [ownerDirectState, ownerDirectAction, isOwnerDirectSaving] = useActionState(
    updateBrandSettingAction,
    initialNoticeState
  );
  const [approveState, approveAction, isApproving] = useActionState(
    approveMarketingDraftAction,
    initialNoticeState
  );
  const [changesState, changesAction, isRequestingChanges] = useActionState(
    requestMarketingDraftChangesAction,
    initialNoticeState
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishMarketingDraftAction,
    initialNoticeState
  );

  const [iconGenState, iconGenAction, isGeneratingIcons] = useActionState(
    generateSiteIconAction,
    {}
  );

  // Find published values
  const publishedMap = useMemo(() => {
    const map: Record<string, MarketingBrandSettingValue> = {};
    for (const setting of brandSettings) {
      map[setting.setting_key] = setting.value;
    }
    return map;
  }, [brandSettings]);

  // Find active mutable draft
  const activeDraft = useMemo(() => {
    const draftFromAction =
      (saveState?.success && (saveState as { draft?: MarketingContentDraftRow }).draft) ||
      (submitState?.success && (submitState as { draft?: MarketingContentDraftRow }).draft);

    if (
      draftFromAction &&
      ["draft", "submitted", "changes_requested", "approved"].includes(draftFromAction.status)
    ) {
      return draftFromAction;
    }

    return drafts.find(
      (d) =>
        d.content_type === "brand" &&
        ["draft", "submitted", "changes_requested", "approved"].includes(d.status)
    );
  }, [drafts, saveState, submitState]);

  // Initial form values
  const initialValues: BrandFormValues = useMemo(() => {
    const livePkg =
      publishedMap.site_icon?.package &&
      typeof publishedMap.site_icon.package === "object"
        ? (publishedMap.site_icon.package as GeneratedSiteIconPackage)
        : null;

    if (activeDraft?.metadata && typeof activeDraft.metadata === "object") {
      const meta = activeDraft.metadata as Record<string, unknown>;
      const draftPkg =
        meta.siteIconPackage && typeof meta.siteIconPackage === "object"
          ? (meta.siteIconPackage as GeneratedSiteIconPackage)
          : livePkg;

      return {
        headerLogoUrl:
          activeDraft.image_url ||
          (meta.headerLogoUrl as string) ||
          (publishedMap.header_logo?.url as string) ||
          "",
        headerLogoAlt:
          activeDraft.alt_text ||
          (meta.headerLogoAlt as string) ||
          (publishedMap.header_logo?.alt as string) ||
          "Cradle Wellness Living",
        footerLogoUrl:
          activeDraft.secondary_image_url ||
          (meta.footerLogoUrl as string) ||
          (publishedMap.footer_logo?.url as string) ||
          "",
        footerLogoAlt:
          (meta.footerLogoAlt as string) ||
          (publishedMap.footer_logo?.alt as string) ||
          "Cradle Wellness Living",
        brandMarkUrl:
          (meta.brandMarkUrl as string) || (publishedMap.brand_mark?.url as string) || "",
        brandMarkAlt:
          (meta.brandMarkAlt as string) ||
          (publishedMap.brand_mark?.alt as string) ||
          "Cradle Brand Mark",
        siteIconMasterUrl:
          (meta.siteIconMasterUrl as string) ||
          draftPkg?.sourceUrl ||
          (publishedMap.brand_mark?.url as string) ||
          "",
        siteIconUrl:
          (meta.siteIconUrl as string) ||
          draftPkg?.icons?.icon32 ||
          (publishedMap.site_icon?.url as string) ||
          "/favicon.ico",
        siteIconAlt:
          (meta.siteIconAlt as string) ||
          (publishedMap.site_icon?.alt as string) ||
          "Cradle Site Icon",
        siteIconPackage: draftPkg,
        taglineText:
          activeDraft.title ||
          (meta.taglineText as string) ||
          (publishedMap.brand_tagline?.text as string) ||
          "A sanctuary of calm in Bacolod.",
        taglineSubtext:
          activeDraft.subtitle ||
          (meta.taglineSubtext as string) ||
          (publishedMap.brand_tagline?.subtext as string) ||
          "Holistic Wellness & Massage Therapy",
      };
    }

    return {
      headerLogoUrl: (publishedMap.header_logo?.url as string) || "",
      headerLogoAlt: (publishedMap.header_logo?.alt as string) || "Cradle Wellness Living",
      footerLogoUrl: (publishedMap.footer_logo?.url as string) || "",
      footerLogoAlt: (publishedMap.footer_logo?.alt as string) || "Cradle Wellness Living",
      brandMarkUrl: (publishedMap.brand_mark?.url as string) || "",
      brandMarkAlt: (publishedMap.brand_mark?.alt as string) || "Cradle Brand Mark",
      siteIconMasterUrl:
        livePkg?.sourceUrl || (publishedMap.brand_mark?.url as string) || "",
      siteIconUrl:
        livePkg?.icons?.icon32 || (publishedMap.site_icon?.url as string) || "/favicon.ico",
      siteIconAlt: (publishedMap.site_icon?.alt as string) || "Cradle Site Icon",
      siteIconPackage: livePkg,
      taglineText:
        (publishedMap.brand_tagline?.text as string) || "A sanctuary of calm in Bacolod.",
      taglineSubtext:
        (publishedMap.brand_tagline?.subtext as string) || "Holistic Wellness & Massage Therapy",
    };
  }, [activeDraft, publishedMap]);

  const [formValues, setFormValues] = useState<BrandFormValues>(initialValues);
  const [previewTab, setPreviewTab] = useState<"header" | "footer" | "mark" | "favicon">("header");
  const [previewMode, setPreviewMode] = useState<"draft" | "live">("draft");
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  // Derive generated package from action state or form state
  const currentSiteIconPackage = useMemo(() => {
    if (iconGenState?.success && iconGenState.package) {
      return iconGenState.package;
    }
    return formValues.siteIconPackage;
  }, [iconGenState, formValues.siteIconPackage]);

  const currentSiteIconUrl = useMemo(() => {
    return currentSiteIconPackage?.icons?.icon32 || formValues.siteIconUrl;
  }, [currentSiteIconPackage, formValues.siteIconUrl]);

  const isDirty = useMemo(() => {
    if (iconGenState?.success && iconGenState.package) return true;
    return JSON.stringify(formValues) !== JSON.stringify(initialValues);
  }, [formValues, initialValues, iconGenState]);

  const handleFieldChange = (field: keyof BrandFormValues, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleRevert = () => {
    setFormValues(initialValues);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Review Note */}
      {activeDraft?.status === "changes_requested" && activeDraft.review_note && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Owner Review Note (
                {activeDraft.reviewed_at
                  ? new Date(activeDraft.reviewed_at).toLocaleDateString()
                  : "Recent"}
                )
              </p>
              <p className="mt-1 text-sm">{activeDraft.review_note}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Notices */}
      {saveState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {saveState.error}
        </div>
      )}
      {saveState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
          {saveState.message}
        </div>
      )}
      {ownerDirectState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
          {ownerDirectState.message}
        </div>
      )}
      {ownerDirectState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {ownerDirectState.error}
        </div>
      )}
      {iconGenState?.message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          {iconGenState.message}
        </div>
      )}
      {iconGenState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {iconGenState.error}
        </div>
      )}

      {/* Main 2-Column Studio Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls (Standardized Light Panels) */}
        <div className="space-y-6 lg:col-span-6">
          <MarketingStudioPanel
            title="Brand Identity & Visual Assets"
            description="Manage official logos, brand mark, site icon package, and mission copy"
            badge={
              <span className="inline-flex items-center rounded-full bg-[var(--cs-surface-warm)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cs-text-secondary)] border border-[var(--cs-border)]">
                {activeDraft ? `Draft: ${activeDraft.status}` : "Live Synced"}
              </span>
            }
          >
            <div className="space-y-6">
              {/* 1. Header Logo */}
              <MarketingFieldGroup
                title="1. Header Logo"
                description="Prominent horizontal brand signature in top navigation"
              >
                <MarketingMediaField
                  label="Header Logo (Horizontal)"
                  intent="HEADER_LOGO"
                  value={formValues.headerLogoUrl}
                  altValue={formValues.headerLogoAlt}
                  onChange={(url, alt) => {
                    handleFieldChange("headerLogoUrl", url);
                    if (alt) handleFieldChange("headerLogoAlt", alt);
                  }}
                  availableAssets={mediaAssets}
                />
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Logo Alt Text
                  </label>
                  <input
                    type="text"
                    value={formValues.headerLogoAlt}
                    onChange={(e) => handleFieldChange("headerLogoAlt", e.target.value)}
                    placeholder="Cradle Wellness Living"
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>

              {/* 2. Footer Logo */}
              <MarketingFieldGroup
                title="2. Footer Logo"
                description="Secondary/contrast logo rendered in footer and dark sections"
              >
                <MarketingMediaField
                  label="Footer Logo (Horizontal)"
                  intent="FOOTER_LOGO"
                  value={formValues.footerLogoUrl}
                  altValue={formValues.footerLogoAlt}
                  onChange={(url, alt) => {
                    handleFieldChange("footerLogoUrl", url);
                    if (alt) handleFieldChange("footerLogoAlt", alt);
                  }}
                  availableAssets={mediaAssets}
                />
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Footer Logo Alt Text
                  </label>
                  <input
                    type="text"
                    value={formValues.footerLogoAlt}
                    onChange={(e) => handleFieldChange("footerLogoAlt", e.target.value)}
                    placeholder="Cradle Wellness Living"
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>

              {/* 3. Brand Mark */}
              <MarketingFieldGroup
                title="3. Brand Mark"
                description="Square emblem for avatars, social sharing, and watermarks"
              >
                <MarketingMediaField
                  label="Brand Mark (Square)"
                  intent="BRAND_MARK"
                  value={formValues.brandMarkUrl}
                  altValue={formValues.brandMarkAlt}
                  onChange={(url, alt) => {
                    handleFieldChange("brandMarkUrl", url);
                    if (alt) handleFieldChange("brandMarkAlt", alt);
                  }}
                  availableAssets={mediaAssets}
                />
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Brand Mark Alt Text
                  </label>
                  <input
                    type="text"
                    value={formValues.brandMarkAlt}
                    onChange={(e) => handleFieldChange("brandMarkAlt", e.target.value)}
                    placeholder="Cradle Brand Mark"
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>

              {/* 4. Dynamic Site Icon Package Generator */}
              <MarketingFieldGroup
                title="4. Website & Device Icon Package"
                description="Upload one master brand image (SVG/PNG min 512x512) to automatically generate all 8 required web/device icons"
                badge={
                  formValues.siteIconPackage ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle className="h-3 w-3" />
                      8 Variants Ready ({formValues.siteIconPackage.version})
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Package Unconfigured
                    </span>
                  )
                }
              >
                <MarketingMediaField
                  label="Master Brand Icon Source"
                  intent="SITE_ICON_MASTER"
                  value={formValues.siteIconMasterUrl}
                  altValue={formValues.siteIconAlt}
                  onChange={(url, alt) => {
                    handleFieldChange("siteIconMasterUrl", url);
                    if (alt) handleFieldChange("siteIconAlt", alt);
                  }}
                  availableAssets={mediaAssets}
                  helperText="Recommended: 1024x1024 SVG or high-resolution PNG with transparent background."
                />

                {/* Generator Trigger */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3">
                  <div className="text-xs">
                    <p className="font-semibold text-[var(--cs-text)]">
                      Automatic Variant Generation
                    </p>
                    <p className="text-[11px] text-[var(--cs-text-secondary)]">
                      Produces 16, 32, 48, 180, 192, 512, maskable 512, and ICO containers.
                    </p>
                  </div>

                  <form action={iconGenAction}>
                    <input
                      type="hidden"
                      name="sourceUrl"
                      value={formValues.siteIconMasterUrl || formValues.brandMarkUrl}
                    />
                    <button
                      type="submit"
                      disabled={
                        isGeneratingIcons ||
                        (!formValues.siteIconMasterUrl && !formValues.brandMarkUrl)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-3.5 py-2 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 text-[#C8A96B] ${
                          isGeneratingIcons ? "animate-spin" : ""
                        }`}
                      />
                      {isGeneratingIcons ? "Generating Icons..." : "Generate Icon Package"}
                    </button>
                  </form>
                </div>

                {/* Generated Icon Variants Grid */}
                {currentSiteIconPackage && currentSiteIconPackage.icons && (
                  <div className="space-y-3 rounded-xl border border-[var(--cs-border-subtle)] bg-[var(--cs-surface)] p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
                      Generated Icon Variants
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { label: "Favicon 16px", key: "icon16", dim: "16x16" },
                        { label: "Favicon 32px", key: "icon32", dim: "32x32" },
                        { label: "Favicon 48px", key: "icon48", dim: "48x48" },
                        { label: "Apple Touch", key: "apple180", dim: "180x180" },
                        { label: "Android PWA", key: "icon192", dim: "192x192" },
                        { label: "Splash 512px", key: "icon512", dim: "512x512" },
                        { label: "Maskable 512", key: "maskable512", dim: "512x512 (Padded)" },
                        { label: "Legacy ICO", key: "ico", dim: "Multi-size" },
                      ].map((item) => {
                        const url =
                          currentSiteIconPackage?.icons[
                            item.key as keyof GeneratedSiteIconPackage["icons"]
                          ];
                        return (
                          <div
                            key={item.key}
                            className="flex flex-col items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-2 text-center"
                          >
                            <div className="h-10 w-10 flex items-center justify-center rounded bg-[var(--cs-surface)] border border-[var(--cs-border-subtle)] overflow-hidden">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={item.label}
                                  className="h-full w-full object-contain p-0.5"
                                />
                              ) : (
                                <span className="text-[10px] text-[var(--cs-text-tertiary)]">
                                  N/A
                                </span>
                              )}
                            </div>
                            <span className="mt-1 text-[11px] font-medium text-[var(--cs-text)]">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-[var(--cs-text-tertiary)]">
                              {item.dim}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </MarketingFieldGroup>

              {/* 5. Tagline & Mission */}
              <MarketingFieldGroup
                title="5. Brand Tagline & Mission"
                description="Core marketing message and descriptive mission statement"
              >
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Primary Tagline
                  </label>
                  <input
                    type="text"
                    value={formValues.taglineText}
                    onChange={(e) => handleFieldChange("taglineText", e.target.value)}
                    placeholder="A sanctuary of calm in Bacolod."
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Mission Subtext
                  </label>
                  <textarea
                    value={formValues.taglineSubtext}
                    onChange={(e) => handleFieldChange("taglineSubtext", e.target.value)}
                    rows={2}
                    placeholder="Experience genuine renewal with our certified massage therapists."
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>
            </div>

            {/* Workflow Action Bar */}
            <div className="mt-6">
              <MarketingActionBar
                role={role}
                draftStatus={
                  activeDraft?.status as
                    | "draft"
                    | "submitted"
                    | "changes_requested"
                    | "approved"
                    | "published"
                    | null
                }
                isDirty={isDirty}
                isSaving={isSaving}
                isSubmitting={isSubmitting}
                isPublishing={isPublishing || isOwnerDirectSaving}
                onRevert={handleRevert}
                customActions={
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Marketer & Owner Save Draft Action */}
                    <form action={saveAction}>
                      <input type="hidden" name="id" value={activeDraft?.id || ""} />
                      <input type="hidden" name="contentType" value="brand" />
                      <input type="hidden" name="contentKey" value="brand_identity" />
                      <input type="hidden" name="title" value={formValues.taglineText} />
                      <input type="hidden" name="subtitle" value={formValues.taglineSubtext} />
                      <input type="hidden" name="imageUrl" value={formValues.headerLogoUrl} />
                      <input
                        type="hidden"
                        name="secondaryImageUrl"
                        value={formValues.footerLogoUrl}
                      />
                      <input type="hidden" name="altText" value={formValues.headerLogoAlt} />
                      <input
                        type="hidden"
                        name="metadata"
                        value={JSON.stringify({
                          headerLogoUrl: formValues.headerLogoUrl,
                          headerLogoAlt: formValues.headerLogoAlt,
                          footerLogoUrl: formValues.footerLogoUrl,
                          footerLogoAlt: formValues.footerLogoAlt,
                          brandMarkUrl: formValues.brandMarkUrl,
                          brandMarkAlt: formValues.brandMarkAlt,
                          siteIconMasterUrl: formValues.siteIconMasterUrl,
                          siteIconUrl: currentSiteIconUrl,
                          siteIconAlt: formValues.siteIconAlt,
                          siteIconPackage: currentSiteIconPackage,
                          taglineText: formValues.taglineText,
                          taglineSubtext: formValues.taglineSubtext,
                        })}
                      />
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3.5 py-2 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface)] disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5 text-[#C8A96B]" />
                        {isSaving ? "Saving..." : "Save Draft"}
                      </button>
                    </form>

                    {/* Submit for Review (Marketer / Owner) */}
                    {activeDraft &&
                      ["draft", "changes_requested"].includes(activeDraft.status) && (
                        <form action={submitAction}>
                          <input type="hidden" name="id" value={activeDraft.id} />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3.5 py-2 text-xs font-semibold text-[#10261D] shadow-xs transition hover:bg-[#D4B57A] disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {isSubmitting ? "Submitting..." : "Submit for Review"}
                          </button>
                        </form>
                      )}

                    {/* Owner Approve & Publish Controls */}
                    {role === "owner" && (
                      <>
                        {activeDraft && activeDraft.status === "submitted" && (
                          <button
                            type="button"
                            onClick={() => setShowChangesModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Request Changes
                          </button>
                        )}

                        {activeDraft &&
                        ["submitted", "approved"].includes(activeDraft.status) ? (
                          <form action={publishAction}>
                            <input type="hidden" name="id" value={activeDraft.id} />
                            <button
                              type="submit"
                              disabled={isPublishing}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
                              {isPublishing ? "Publishing..." : "Publish to Live"}
                            </button>
                          </form>
                        ) : (
                          <form action={ownerDirectAction}>
                            <input
                              type="hidden"
                              name="headerLogoUrl"
                              value={formValues.headerLogoUrl}
                            />
                            <input
                              type="hidden"
                              name="headerLogoAlt"
                              value={formValues.headerLogoAlt}
                            />
                            <input
                              type="hidden"
                              name="footerLogoUrl"
                              value={formValues.footerLogoUrl}
                            />
                            <input
                              type="hidden"
                              name="footerLogoAlt"
                              value={formValues.footerLogoAlt}
                            />
                            <input
                              type="hidden"
                              name="brandMarkUrl"
                              value={formValues.brandMarkUrl}
                            />
                            <input
                              type="hidden"
                              name="brandMarkAlt"
                              value={formValues.brandMarkAlt}
                            />
                            <input
                              type="hidden"
                              name="siteIconUrl"
                              value={currentSiteIconUrl}
                            />
                            <input
                              type="hidden"
                              name="siteIconAlt"
                              value={formValues.siteIconAlt}
                            />
                            <input
                              type="hidden"
                              name="siteIconPackage"
                              value={
                                currentSiteIconPackage
                                  ? JSON.stringify(currentSiteIconPackage)
                                  : ""
                              }
                            />
                            <input
                              type="hidden"
                              name="taglineText"
                              value={formValues.taglineText}
                            />
                            <input
                              type="hidden"
                              name="taglineSubtext"
                              value={formValues.taglineSubtext}
                            />
                            <button
                              type="submit"
                              disabled={isOwnerDirectSaving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
                              {isOwnerDirectSaving ? "Publishing..." : "Publish Live Directly"}
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                }
              />
            </div>
          </MarketingStudioPanel>
        </div>

        {/* Right Column: High-Fidelity Public Brand Live Preview */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/95 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#C8A96B]" />
                <h3 className="text-sm font-medium text-[#F6EBD6]">Live Brand Preview</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-[#061410] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode("draft")}
                  className={`rounded-md px-2.5 py-1 ${
                    previewMode === "draft"
                      ? "bg-[#163A2B] font-semibold text-[#F6EBD6]"
                      : "text-[#9AA89A] hover:text-[#F6EBD6]"
                  }`}
                >
                  Draft Values
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("live")}
                  className={`rounded-md px-2.5 py-1 ${
                    previewMode === "live"
                      ? "bg-[#163A2B] font-semibold text-[#F6EBD6]"
                      : "text-[#9AA89A] hover:text-[#F6EBD6]"
                  }`}
                >
                  Live Published
                </button>
              </div>
            </div>

            {/* Preview Sub-tabs */}
            <div className="mt-4 flex flex-wrap gap-2 border-b border-white/5 pb-3">
              {(
                [
                  { id: "header", label: "Header Navbar" },
                  { id: "footer", label: "Footer" },
                  { id: "mark", label: "Brand Mark" },
                  { id: "favicon", label: "Browser & Device Icons" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewTab === tab.id
                      ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "text-[#9AA89A] hover:text-[#F6EBD6]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active Preview Surface */}
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#031B16] p-4">
              {/* Header Preview */}
              {previewTab === "header" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#C8A96B]/20 bg-[#10261D] p-4">
                    <div className="flex items-center justify-between">
                      {/* Logo slot */}
                      <div className="flex items-center gap-3">
                        {previewMode === "draft" && formValues.headerLogoUrl ? (
                          <img
                            src={formValues.headerLogoUrl}
                            alt={formValues.headerLogoAlt}
                            className="h-9 w-auto max-w-[180px] object-contain"
                          />
                        ) : (
                          <BrandLogo size="sm" variant="dark" className="w-32" />
                        )}
                      </div>
                      <div className="hidden gap-4 text-xs text-[#9AA89A] sm:flex">
                        <span>Services</span>
                        <span>Book</span>
                        <span>Branches</span>
                        <span>About</span>
                        <span>Contact</span>
                      </div>
                      <div className="rounded-full border border-[#C8A96B]/40 px-3 py-1 text-[11px] text-[#C8A96B]">
                        Book Now
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[11px] text-[#9AA89A]">
                    Previewing Header Navigation Logo on dark transparent glass surface
                  </p>
                </div>
              )}

              {/* Footer Preview */}
              {previewTab === "footer" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#163A2B] bg-[#10261D] p-6 text-[#9AA89A]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-xs space-y-2">
                        {previewMode === "draft" && formValues.footerLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={formValues.footerLogoUrl}
                            alt={formValues.footerLogoAlt}
                            className="h-9 w-auto max-w-[160px] object-contain"
                          />
                        ) : (
                          <BrandLogo size="md" variant="dark" className="w-36" />
                        )}
                        <p className="text-xs text-[#FCFAF5]">
                          {previewMode === "draft"
                            ? formValues.taglineText
                            : (publishedMap.brand_tagline?.text as string) ||
                              "A sanctuary of calm in Bacolod."}
                        </p>
                        <p className="text-[11px] text-[#6B7A6F]">
                          {previewMode === "draft"
                            ? formValues.taglineSubtext
                            : (publishedMap.brand_tagline?.subtext as string) ||
                              "Holistic Wellness & Massage Therapy"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-[#C8A96B]">Branches</p>
                          <p>Lacson Main Spa</p>
                          <p>SM City Bacolod</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-[#C8A96B]">Quick Links</p>
                          <p>Signature Services</p>
                          <p>Spa Etiquette</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[11px] text-[#9AA89A]">
                    Previewing Footer Logo and brand mission statement
                  </p>
                </div>
              )}

              {/* Brand Mark Preview */}
              {previewTab === "mark" && (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-[#D4B57A]/20 bg-[#10261D] p-4 shadow-inner">
                    {previewMode === "draft" && formValues.brandMarkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formValues.brandMarkUrl}
                        alt={formValues.brandMarkAlt}
                        className="h-20 w-20 object-contain"
                      />
                    ) : (
                      <BrandLogo mode="mark" size="md" variant="dark" className="w-20" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#F6EBD6]">
                      {formValues.brandMarkAlt || "Cradle Brand Mark"}
                    </p>
                    <p className="text-xs text-[#9AA89A]">
                      Used for mobile icons, avatars, and watermarks
                    </p>
                  </div>
                </div>
              )}

              {/* Favicon & Device Preview */}
              {previewTab === "favicon" && (
                <div className="space-y-5">
                  {/* Browser Tabs Simulation */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#C8A96B] font-semibold">
                      <Laptop className="h-3.5 w-3.5" />
                      Browser Tab Preview (16px / 32px Favicon)
                    </div>

                    {/* Dark Browser Tab */}
                    <div className="rounded-lg border border-white/10 bg-[#1E293B] p-2 text-slate-200">
                      <div className="flex items-center gap-2 rounded-md bg-[#0F172A] px-3 py-1.5 text-xs">
                        {previewMode === "draft" &&
                        (currentSiteIconPackage?.icons?.icon32 || currentSiteIconUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              currentSiteIconPackage?.icons?.icon32 ||
                              currentSiteIconUrl
                            }
                            alt={formValues.siteIconAlt}
                            className="h-4 w-4 rounded-xs object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full bg-[#C8A96B]" />
                        )}
                        <span className="truncate font-medium">
                          Cradle Wellness Living | Luxury Spa
                        </span>
                      </div>
                    </div>

                    {/* Light Browser Tab */}
                    <div className="rounded-lg border border-slate-300 bg-slate-200 p-2 text-slate-800">
                      <div className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs shadow-xs">
                        {previewMode === "draft" &&
                        (currentSiteIconPackage?.icons?.icon32 || currentSiteIconUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              currentSiteIconPackage?.icons?.icon32 ||
                              currentSiteIconUrl
                            }
                            alt={formValues.siteIconAlt}
                            className="h-4 w-4 rounded-xs object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full bg-[#C8A96B]" />
                        )}
                        <span className="truncate font-medium">
                          Cradle Wellness Living | Luxury Spa
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Home Screen App Icon Simulation */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#C8A96B] font-semibold">
                      <Smartphone className="h-3.5 w-3.5" />
                      Mobile & Tablet Home Screen (180px Apple Touch / 192px Android)
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#061410] p-4">
                      <div className="h-16 w-16 rounded-2xl bg-white p-2 shadow-lg border border-white/10 flex items-center justify-center overflow-hidden">
                        {currentSiteIconPackage?.icons?.apple180 ||
                        currentSiteIconPackage?.icons?.icon192 ||
                        formValues.siteIconMasterUrl ||
                        formValues.brandMarkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              currentSiteIconPackage?.icons?.apple180 ||
                              currentSiteIconPackage?.icons?.icon192 ||
                              formValues.siteIconMasterUrl ||
                              formValues.brandMarkUrl
                            }
                            alt="Home Screen Icon"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <BrandLogo mode="mark" size="sm" variant="dark" />
                        )}
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-[#F6EBD6]">Cradle Spa</p>
                        <p className="text-[11px] text-[#9AA89A]">
                          Automatic safe-area containment with transparent background
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Dialog (Owner) */}
      <Dialog open={showChangesModal} onOpenChange={setShowChangesModal}>
        <DialogContent className="border-[#D4B57A]/20 bg-[#0A1F18] text-[#F6EBD6]">
          <DialogHeader>
            <DialogTitle className="text-[#F6EBD6]">Request Changes for Brand Draft</DialogTitle>
            <DialogDescription className="text-[#9AA89A]">
              Provide feedback or instructions for the digital marketing team.
            </DialogDescription>
          </DialogHeader>
          <form action={changesAction} className="space-y-4">
            <input type="hidden" name="id" value={activeDraft?.id || ""} />
            <div>
              <label htmlFor="brandReviewNote" className="text-xs text-[#9AA89A]">
                Review Note / Feedback
              </label>
              <textarea
                id="brandReviewNote"
                name="reviewNote"
                rows={4}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Explain what needs adjustment before publishing..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] p-3 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-[#9AA89A] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRequestingChanges}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-[#10261D] hover:bg-amber-400 disabled:opacity-50"
              >
                {isRequestingChanges ? "Submitting..." : "Send Request"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
