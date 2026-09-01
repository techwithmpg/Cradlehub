"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  ImageIcon,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Upload,
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
import type { SelectedMediaValue } from "@/components/features/marketing/media/universal-media-picker";
import { UniversalMediaPicker } from "@/components/features/marketing/media/universal-media-picker";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import {
  approveMarketingDraftAction,
  archiveMarketingDraftAction,
  publishMarketingDraftAction,
  requestMarketingDraftChangesAction,
} from "@/app/(dashboard)/owner/marketing/actions";
import { updateBrandSettingAction } from "@/app/(dashboard)/marketing/brand-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  siteIconUrl: string;
  siteIconAlt: string;
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
    if (activeDraft?.metadata && typeof activeDraft.metadata === "object") {
      const meta = activeDraft.metadata as Record<string, string>;
      return {
        headerLogoUrl:
          activeDraft.image_url ||
          meta.headerLogoUrl ||
          (publishedMap.header_logo?.url as string) ||
          "",
        headerLogoAlt:
          activeDraft.alt_text ||
          meta.headerLogoAlt ||
          (publishedMap.header_logo?.alt as string) ||
          "Cradle Wellness Living",
        footerLogoUrl:
          activeDraft.secondary_image_url ||
          meta.footerLogoUrl ||
          (publishedMap.footer_logo?.url as string) ||
          "",
        footerLogoAlt:
          meta.footerLogoAlt ||
          (publishedMap.footer_logo?.alt as string) ||
          "Cradle Wellness Living",
        brandMarkUrl: meta.brandMarkUrl || (publishedMap.brand_mark?.url as string) || "",
        brandMarkAlt:
          meta.brandMarkAlt || (publishedMap.brand_mark?.alt as string) || "Cradle Brand Mark",
        siteIconUrl: meta.siteIconUrl || (publishedMap.site_icon?.url as string) || "/favicon.ico",
        siteIconAlt:
          meta.siteIconAlt || (publishedMap.site_icon?.alt as string) || "Cradle Site Icon",
        taglineText:
          activeDraft.title ||
          meta.taglineText ||
          (publishedMap.brand_tagline?.text as string) ||
          "A sanctuary of calm in Bacolod.",
        taglineSubtext:
          activeDraft.subtitle ||
          meta.taglineSubtext ||
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
      siteIconUrl: (publishedMap.site_icon?.url as string) || "/favicon.ico",
      siteIconAlt: (publishedMap.site_icon?.alt as string) || "Cradle Site Icon",
      taglineText:
        (publishedMap.brand_tagline?.text as string) || "A sanctuary of calm in Bacolod.",
      taglineSubtext:
        (publishedMap.brand_tagline?.subtext as string) || "Holistic Wellness & Massage Therapy",
    };
  }, [activeDraft, publishedMap]);

  const [formValues, setFormValues] = useState<BrandFormValues>(initialValues);
  const [activeTab, setActiveTab] = useState<"header" | "footer" | "mark" | "favicon">("header");
  const [previewMode, setPreviewMode] = useState<"draft" | "live">("draft");
  const [pickerTarget, setPickerTarget] = useState<keyof BrandFormValues | null>(null);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(initialValues);
  }, [formValues, initialValues]);

  const handleFieldChange = (field: keyof BrandFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleMediaSelect = (value: SelectedMediaValue) => {
    if (!pickerTarget) return;
    const urlField = pickerTarget;
    const altField = pickerTarget.replace("Url", "Alt") as keyof BrandFormValues;

    setFormValues((prev) => ({
      ...prev,
      [urlField]: value.publicUrl || "",
      [altField]: prev[altField] || value.altText || "",
    }));
    setPickerTarget(null);
  };

  const handleRevert = () => {
    setFormValues(initialValues);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Review Note */}
      {activeDraft?.status === "changes_requested" && activeDraft.review_note && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
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
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {saveState.error}
        </div>
      )}
      {saveState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
          {saveState.message}
        </div>
      )}
      {ownerDirectState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
          {ownerDirectState.message}
        </div>
      )}
      {ownerDirectState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {ownerDirectState.error}
        </div>
      )}

      {/* Main 2-Column Studio Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/90 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-4">
              <div>
                <h2 className="text-lg font-medium text-[#F6EBD6]">Brand Identity & Assets</h2>
                <p className="text-xs text-[#9AA89A]">
                  Manage header & footer logos, brand marks, and site identity
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    Unsaved Edits
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-[#163A2B] px-2.5 py-0.5 text-[11px] font-medium text-[#C8A96B]">
                  {activeDraft ? `Draft: ${activeDraft.status}` : "Live Synced"}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="mt-6 space-y-5">
              {/* Header Logo */}
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                    Header Logo (Horizontal)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickerTarget("headerLogoUrl")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/30 bg-[#163A2B] px-2.5 py-1 text-xs text-[#F6EBD6] hover:bg-[#1D4A35]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
                    Choose Media
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Logo Image URL / Path</span>
                    <input
                      type="text"
                      value={formValues.headerLogoUrl}
                      onChange={(e) => handleFieldChange("headerLogoUrl", e.target.value)}
                      placeholder="/assets/brand/cradle-logo-horizontal.svg"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Alt Text</span>
                    <input
                      type="text"
                      value={formValues.headerLogoAlt}
                      onChange={(e) => handleFieldChange("headerLogoAlt", e.target.value)}
                      placeholder="Cradle Wellness Living"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Logo */}
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                    Footer Logo (Alternate / Contrast)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickerTarget("footerLogoUrl")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/30 bg-[#163A2B] px-2.5 py-1 text-xs text-[#F6EBD6] hover:bg-[#1D4A35]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
                    Choose Media
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Logo Image URL / Path</span>
                    <input
                      type="text"
                      value={formValues.footerLogoUrl}
                      onChange={(e) => handleFieldChange("footerLogoUrl", e.target.value)}
                      placeholder="/assets/brand/cradle-logo-horizontal.svg"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Alt Text</span>
                    <input
                      type="text"
                      value={formValues.footerLogoAlt}
                      onChange={(e) => handleFieldChange("footerLogoAlt", e.target.value)}
                      placeholder="Cradle Wellness Living"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Brand Mark */}
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                    Brand Mark / Emblem
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickerTarget("brandMarkUrl")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/30 bg-[#163A2B] px-2.5 py-1 text-xs text-[#F6EBD6] hover:bg-[#1D4A35]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
                    Choose Media
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Mark Image URL</span>
                    <input
                      type="text"
                      value={formValues.brandMarkUrl}
                      onChange={(e) => handleFieldChange("brandMarkUrl", e.target.value)}
                      placeholder="/assets/brand/cradle-logo-mark.svg"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Alt Text</span>
                    <input
                      type="text"
                      value={formValues.brandMarkAlt}
                      onChange={(e) => handleFieldChange("brandMarkAlt", e.target.value)}
                      placeholder="Cradle Brand Mark"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Site Icon / Favicon Asset */}
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                      Site Icon / Favicon Asset
                    </label>
                    <p className="text-[11px] text-[#9AA89A]">
                      Root browser icon preview and manifest icon registration
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerTarget("siteIconUrl")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/30 bg-[#163A2B] px-2.5 py-1 text-xs text-[#F6EBD6] hover:bg-[#1D4A35]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
                    Choose Media
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Icon URL / File</span>
                    <input
                      type="text"
                      value={formValues.siteIconUrl}
                      onChange={(e) => handleFieldChange("siteIconUrl", e.target.value)}
                      placeholder="/favicon.ico"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Alt Text</span>
                    <input
                      type="text"
                      value={formValues.siteIconAlt}
                      onChange={(e) => handleFieldChange("siteIconAlt", e.target.value)}
                      placeholder="Cradle Site Icon"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Brand Tagline */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                  Brand Tagline & Mission Copy
                </label>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Primary Tagline</span>
                  <input
                    type="text"
                    value={formValues.taglineText}
                    onChange={(e) => handleFieldChange("taglineText", e.target.value)}
                    placeholder="A sanctuary of calm in Bacolod."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Mission Subtext</span>
                  <textarea
                    value={formValues.taglineSubtext}
                    onChange={(e) => handleFieldChange("taglineSubtext", e.target.value)}
                    rows={2}
                    placeholder="Experience genuine renewal with our certified massage therapists."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Workflow Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={handleRevert}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#9AA89A] hover:bg-white/5 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revert to Saved
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {/* Save Draft Action */}
                <form action={saveAction}>
                  <input type="hidden" name="id" value={activeDraft?.id || ""} />
                  <input type="hidden" name="contentType" value="brand" />
                  <input type="hidden" name="contentKey" value="brand_identity" />
                  <input type="hidden" name="title" value={formValues.taglineText} />
                  <input type="hidden" name="subtitle" value={formValues.taglineSubtext} />
                  <input type="hidden" name="imageUrl" value={formValues.headerLogoUrl} />
                  <input type="hidden" name="secondaryImageUrl" value={formValues.footerLogoUrl} />
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
                      siteIconUrl: formValues.siteIconUrl,
                      siteIconAlt: formValues.siteIconAlt,
                      taglineText: formValues.taglineText,
                      taglineSubtext: formValues.taglineSubtext,
                    })}
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/40 bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] hover:bg-[#1D4A35] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5 text-[#C8A96B]" />
                    {isSaving ? "Saving..." : "Save Draft"}
                  </button>
                </form>

                {/* Submit for Review (Marketer / Owner) */}
                {activeDraft && ["draft", "changes_requested"].includes(activeDraft.status) && (
                  <form action={submitAction}>
                    <input type="hidden" name="id" value={activeDraft.id} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-4 py-2 text-xs font-semibold text-[#10261D] hover:bg-[#D4B57A] disabled:opacity-50"
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Request Changes
                      </button>
                    )}

                    {activeDraft && ["submitted", "approved"].includes(activeDraft.status) ? (
                      <form action={publishAction}>
                        <input type="hidden" name="id" value={activeDraft.id} />
                        <button
                          type="submit"
                          disabled={isPublishing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
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
                        <input type="hidden" name="brandMarkUrl" value={formValues.brandMarkUrl} />
                        <input type="hidden" name="brandMarkAlt" value={formValues.brandMarkAlt} />
                        <input type="hidden" name="siteIconUrl" value={formValues.siteIconUrl} />
                        <input type="hidden" name="siteIconAlt" value={formValues.siteIconAlt} />
                        <input type="hidden" name="taglineText" value={formValues.taglineText} />
                        <input
                          type="hidden"
                          name="taglineSubtext"
                          value={formValues.taglineSubtext}
                        />
                        <input type="hidden" name="draftId" value={activeDraft?.id || ""} />
                        <button
                          type="submit"
                          disabled={isOwnerDirectSaving}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {isOwnerDirectSaving ? "Publishing..." : "Publish Live Settings"}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Fidelity Brand Preview */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/90 p-6 shadow-xl backdrop-blur-md">
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
            <div className="mt-4 flex gap-2 border-b border-white/5 pb-3">
              {(
                [
                  { id: "header", label: "Header Navbar" },
                  { id: "footer", label: "Footer" },
                  { id: "mark", label: "Brand Mark" },
                  { id: "favicon", label: "Browser Tab / Icon" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
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
              {activeTab === "header" && (
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
              {activeTab === "footer" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#163A2B] bg-[#10261D] p-6 text-[#9AA89A]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-xs space-y-2">
                        {previewMode === "draft" && formValues.footerLogoUrl ? (
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
              {activeTab === "mark" && (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-[#D4B57A]/20 bg-[#10261D] p-4 shadow-inner">
                    {previewMode === "draft" && formValues.brandMarkUrl ? (
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

              {/* Favicon Preview */}
              {activeTab === "favicon" && (
                <div className="space-y-4">
                  {/* Browser Tab Mock */}
                  <div className="rounded-lg border border-white/10 bg-[#1E293B] p-2 text-slate-200">
                    <div className="flex items-center gap-2 rounded-md bg-[#0F172A] px-3 py-1.5 text-xs">
                      {previewMode === "draft" && formValues.siteIconUrl ? (
                        <img
                          src={formValues.siteIconUrl}
                          alt={formValues.siteIconAlt}
                          className="h-4 w-4 rounded-sm object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full bg-[#C8A96B]" />
                      )}
                      <span className="truncate font-medium">
                        Cradle Wellness Living | Massage & Spa
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-xs text-[#9AA89A] space-y-2">
                    <p className="font-semibold text-[#C8A96B]">
                      Next.js Static Favicon Architecture Note:
                    </p>
                    <p>
                      The public site icon is served via Next.js root layout at{" "}
                      <code className="text-[#F6EBD6]">/favicon.ico</code>. Selecting an asset here
                      registers it in site metadata and manifest settings.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Universal Media Picker Modal */}
      {pickerTarget && (
        <UniversalMediaPicker
          isOpen={!!pickerTarget}
          onClose={() => setPickerTarget(null)}
          onSelect={handleMediaSelect}
          currentUrl={formValues[pickerTarget] as string}
          title={`Choose Media for ${pickerTarget.replace("Url", "")}`}
          availableAssets={mediaAssets}
        />
      )}

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
