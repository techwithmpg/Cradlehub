"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Send,
} from "lucide-react";
import type { Database } from "@/types/supabase";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import { publishMarketingDraftAction } from "@/app/(dashboard)/owner/marketing/actions";
import { updateBranchPresentationAction } from "@/app/(dashboard)/marketing/branch-actions";
import { MarketingStudioPanel } from "@/components/features/marketing/shared/marketing-studio-panel";
import { MarketingFieldGroup } from "@/components/features/marketing/shared/marketing-field-group";
import { MarketingMediaField } from "@/components/features/marketing/shared/marketing-media-field";
import { MarketingActionBar } from "@/components/features/marketing/shared/marketing-action-bar";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type BranchesStudioViewProps = {
  role: "digital_marketer" | "owner";
  branches: BranchRow[];
  drafts?: MarketingContentDraftRow[];
  revisions?: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
};

type BranchFormValues = {
  name: string;
  address: string;
  phone: string;
  email: string;
  fbPage: string;
  messengerLink: string;
  openingHours: string;
  mapsEmbedUrl: string;
  imageUrl: string;
};

function getBranchImageUrl(branch: BranchRow): string {
  if (
    branch.location_metadata &&
    typeof branch.location_metadata === "object" &&
    !Array.isArray(branch.location_metadata)
  ) {
    const meta = branch.location_metadata as Record<string, unknown>;
    if (typeof meta.image_url === "string" && meta.image_url.trim().length > 0) {
      return meta.image_url;
    }
  }
  return branch.name.toLowerCase().includes("sm")
    ? "/images/spa/cradle-sm-branch.webp"
    : "/images/spa/cradle-main-spa.webp";
}

export function BranchesStudioView({
  role,
  branches = [],
  drafts = [],
  revisions: _revisions = [],
  mediaAssets = [],
}: BranchesStudioViewProps) {
  // Sort branches: Main Spa first, SM second
  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      const aIsMain =
        a.name.toLowerCase().includes("main") || a.name.toLowerCase().includes("lacson");
      const bIsMain =
        b.name.toLowerCase().includes("main") || b.name.toLowerCase().includes("lacson");
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [branches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    sortedBranches[0]?.id || ""
  );

  const initialNoticeState = { success: true, message: "" };

  // Action states
  const [saveState, saveAction, isSaving] = useActionState(
    saveMarketingDraftAction,
    initialNoticeState
  );
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitMarketingDraftAction,
    initialNoticeState
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishMarketingDraftAction,
    initialNoticeState
  );
  const [ownerUpdateState, ownerUpdateAction, isOwnerUpdating] = useActionState(
    updateBranchPresentationAction,
    initialNoticeState
  );

  const currentBranch = useMemo(() => {
    return sortedBranches.find((b) => b.id === selectedBranchId) || sortedBranches[0];
  }, [sortedBranches, selectedBranchId]);

  // Find active mutable draft for current branch ONLY
  const activeBranchDraft = useMemo(() => {
    if (!currentBranch) return null;
    const branchKey = `branch_${currentBranch.id.replace(/-/g, "_")}`;

    const draftFromAction =
      (saveState?.success && (saveState as { draft?: MarketingContentDraftRow }).draft) ||
      (submitState?.success && (submitState as { draft?: MarketingContentDraftRow }).draft);

    if (
      draftFromAction &&
      draftFromAction.content_type === "section" &&
      draftFromAction.content_key === branchKey &&
      ["draft", "submitted", "changes_requested", "approved"].includes(draftFromAction.status)
    ) {
      return draftFromAction;
    }

    return (
      drafts.find(
        (d) =>
          d.content_type === "section" &&
          d.content_key === branchKey &&
          ["draft", "submitted", "changes_requested", "approved"].includes(d.status)
      ) ?? null
    );
  }, [currentBranch, drafts, saveState, submitState]);

  // Initialize form values from active mutable draft or live branch row
  const initialValues: BranchFormValues = useMemo(() => {
    if (!currentBranch) {
      return {
        name: "",
        address: "",
        phone: "",
        email: "",
        fbPage: "",
        messengerLink: "",
        openingHours: "10:00 AM - 10:00 PM Daily",
        mapsEmbedUrl: "",
        imageUrl: "",
      };
    }

    const meta = (currentBranch.location_metadata || {}) as Record<string, unknown>;
    const imgUrl = typeof meta.image_url === "string" ? meta.image_url : "";

    if (activeBranchDraft) {
      const draftMeta =
        activeBranchDraft.metadata &&
        typeof activeBranchDraft.metadata === "object" &&
        !Array.isArray(activeBranchDraft.metadata)
          ? (activeBranchDraft.metadata as Record<string, unknown>)
          : {};

      return {
        name:
          (typeof draftMeta.name === "string" && draftMeta.name) ||
          activeBranchDraft.title ||
          currentBranch.name ||
          "",
        address:
          (typeof draftMeta.address === "string" && draftMeta.address) ||
          activeBranchDraft.body ||
          currentBranch.address ||
          "",
        phone:
          (typeof draftMeta.phone === "string" && draftMeta.phone) ||
          activeBranchDraft.cta_label ||
          currentBranch.phone ||
          "",
        email:
          (typeof draftMeta.email === "string" && draftMeta.email) || currentBranch.email || "",
        fbPage:
          (typeof draftMeta.fbPage === "string" && draftMeta.fbPage) || currentBranch.fb_page || "",
        messengerLink:
          (typeof draftMeta.messengerLink === "string" && draftMeta.messengerLink) ||
          currentBranch.messenger_link ||
          "",
        openingHours:
          (typeof draftMeta.openingHours === "string" && draftMeta.openingHours) ||
          activeBranchDraft.subtitle ||
          currentBranch.opening_hours ||
          "10:00 AM - 10:00 PM Daily",
        mapsEmbedUrl:
          (typeof draftMeta.mapsEmbedUrl === "string" && draftMeta.mapsEmbedUrl) ||
          currentBranch.maps_embed_url ||
          "",
        imageUrl: activeBranchDraft.image_url || imgUrl || getBranchImageUrl(currentBranch),
      };
    }

    return {
      name: currentBranch.name || "",
      address: currentBranch.address || "",
      phone: currentBranch.phone || "",
      email: currentBranch.email || "",
      fbPage: currentBranch.fb_page || "",
      messengerLink: currentBranch.messenger_link || "",
      openingHours: currentBranch.opening_hours || "10:00 AM - 10:00 PM Daily",
      mapsEmbedUrl: currentBranch.maps_embed_url || "",
      imageUrl: imgUrl || getBranchImageUrl(currentBranch),
    };
  }, [currentBranch, activeBranchDraft]);

  const [formValues, setFormValues] = useState<BranchFormValues>(initialValues);

  // Sync form values when selected branch changes
  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    const branch = sortedBranches.find((b) => b.id === branchId);
    if (branch) {
      const branchKey = `branch_${branch.id.replace(/-/g, "_")}`;
      const branchDraft = drafts.find(
        (d) =>
          d.content_type === "section" &&
          d.content_key === branchKey &&
          ["draft", "submitted", "changes_requested", "approved"].includes(d.status)
      );

      const meta = (branch.location_metadata || {}) as Record<string, unknown>;
      const imgUrl = typeof meta.image_url === "string" ? meta.image_url : "";

      if (branchDraft) {
        const draftMeta =
          branchDraft.metadata &&
          typeof branchDraft.metadata === "object" &&
          !Array.isArray(branchDraft.metadata)
            ? (branchDraft.metadata as Record<string, unknown>)
            : {};

        setFormValues({
          name:
            (typeof draftMeta.name === "string" && draftMeta.name) ||
            branchDraft.title ||
            branch.name ||
            "",
          address:
            (typeof draftMeta.address === "string" && draftMeta.address) ||
            branchDraft.body ||
            branch.address ||
            "",
          phone:
            (typeof draftMeta.phone === "string" && draftMeta.phone) ||
            branchDraft.cta_label ||
            branch.phone ||
            "",
          email: (typeof draftMeta.email === "string" && draftMeta.email) || branch.email || "",
          fbPage:
            (typeof draftMeta.fbPage === "string" && draftMeta.fbPage) || branch.fb_page || "",
          messengerLink:
            (typeof draftMeta.messengerLink === "string" && draftMeta.messengerLink) ||
            branch.messenger_link ||
            "",
          openingHours:
            (typeof draftMeta.openingHours === "string" && draftMeta.openingHours) ||
            branchDraft.subtitle ||
            branch.opening_hours ||
            "10:00 AM - 10:00 PM Daily",
          mapsEmbedUrl:
            (typeof draftMeta.mapsEmbedUrl === "string" && draftMeta.mapsEmbedUrl) ||
            branch.maps_embed_url ||
            "",
          imageUrl: branchDraft.image_url || imgUrl || getBranchImageUrl(branch),
        });
      } else {
        setFormValues({
          name: branch.name || "",
          address: branch.address || "",
          phone: branch.phone || "",
          email: branch.email || "",
          fbPage: branch.fb_page || "",
          messengerLink: branch.messenger_link || "",
          openingHours: branch.opening_hours || "10:00 AM - 10:00 PM Daily",
          mapsEmbedUrl: branch.maps_embed_url || "",
          imageUrl: imgUrl || getBranchImageUrl(branch),
        });
      }
    }
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(initialValues);
  }, [formValues, initialValues]);

  const handleFieldChange = (field: keyof BranchFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  if (!currentBranch) {
    return (
      <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 text-center text-[var(--cs-text-secondary)]">
        <Building2 className="mx-auto h-8 w-8 text-[#C8A96B] mb-2" />
        <p className="text-sm font-medium text-[var(--cs-text)]">No active branches found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action notices */}
      {ownerUpdateState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
          {ownerUpdateState.message}
        </div>
      )}
      {ownerUpdateState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {ownerUpdateState.error}
        </div>
      )}
      {publishState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
          {publishState.message}
        </div>
      )}
      {publishState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {publishState.error}
        </div>
      )}
      {saveState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
          {saveState.message}
        </div>
      )}

      {/* Branch Selection Bar (Standardized Light Panel) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cs-surface-warm)] border border-[var(--cs-border)] text-[#C8A96B]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--cs-text)]">Select Branch to Manage</h3>
            <p className="text-xs text-[var(--cs-text-secondary)]">
              Manage public contact info, hours, and branch photography
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedBranches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            const isMain =
              branch.name.toLowerCase().includes("main") ||
              branch.name.toLowerCase().includes("lacson");
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleSelectBranch(branch.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "border border-[#C8A96B]/50 bg-[#163A2B] text-[#F6EBD6] shadow-sm"
                    : "border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[#C8A96B]/30 hover:text-[var(--cs-text)]"
                }`}
              >
                <MapPin
                  className={`h-3.5 w-3.5 ${isSelected ? "text-[#C8A96B]" : "text-[var(--cs-text-tertiary)]"}`}
                />
                <span>{branch.name}</span>
                {isMain && (
                  <span className="rounded bg-[#C8A96B]/20 px-1.5 py-0.5 text-[10px] text-[#C8A96B]">
                    Flagship
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Studio 2-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls (Standardized Light Panels) */}
        <div className="space-y-6 lg:col-span-6">
          <MarketingStudioPanel
            title={currentBranch.name}
            description="Public presentation, contact channels, and location details"
            badge={
              <span className="inline-flex items-center rounded-full bg-[var(--cs-surface-warm)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cs-text-secondary)] border border-[var(--cs-border)]">
                {activeBranchDraft ? `Draft: ${activeBranchDraft.status}` : "Live Synced"}
              </span>
            }
          >
            <div className="space-y-5">
              {/* 1. Branch Identification */}
              <MarketingFieldGroup
                title="1. Branch Identification & Location"
                description="Official branch name and full physical address"
              >
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Public Branch Name
                  </label>
                  <input
                    type="text"
                    aria-label="Public Branch Name"
                    value={formValues.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Full Street Address
                  </label>
                  <textarea
                    rows={2}
                    aria-label="Full Street Address"
                    value={formValues.address}
                    onChange={(e) => handleFieldChange("address", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>

              {/* 2. Guest Contact Channels */}
              <MarketingFieldGroup
                title="2. Guest Contact Channels"
                description="Phone, email, and social direct booking channels"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Primary Phone
                    </label>
                    <input
                      type="text"
                      aria-label="Primary Phone"
                      value={formValues.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="0917-xxx-xxxx / (034) 433-xxxx"
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Branch Email
                    </label>
                    <input
                      type="email"
                      aria-label="Branch Email"
                      value={formValues.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="branch@cradlemassage.ph"
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Facebook Page URL
                    </label>
                    <input
                      type="text"
                      value={formValues.fbPage}
                      onChange={(e) => handleFieldChange("fbPage", e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Messenger Link (m.me)
                    </label>
                    <input
                      type="text"
                      value={formValues.messengerLink}
                      onChange={(e) => handleFieldChange("messengerLink", e.target.value)}
                      placeholder="https://m.me/..."
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Opening Hours Schedule
                  </label>
                  <input
                    type="text"
                    value={formValues.openingHours}
                    onChange={(e) => handleFieldChange("openingHours", e.target.value)}
                    placeholder="10:00 AM - 10:00 PM Daily"
                    className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </MarketingFieldGroup>

              {/* 3. Branch Photography & Map Embed */}
              <MarketingFieldGroup
                title="3. Branch Photography & Map"
                description="High-resolution exterior/interior hero photo (16:9) and map embed"
              >
                <MarketingMediaField
                  label="Branch Hero Photo (16:9 Landscape)"
                  intent="BRANCH_PHOTO"
                  value={formValues.imageUrl}
                  altValue={formValues.name}
                  onChange={(url) => handleFieldChange("imageUrl", url)}
                  availableAssets={mediaAssets}
                />
                <div>
                  <label className="text-xs font-semibold text-[var(--cs-text)]">
                    Google Maps Embed URL
                  </label>
                  <input
                    type="text"
                    value={formValues.mapsEmbedUrl}
                    onChange={(e) => handleFieldChange("mapsEmbedUrl", e.target.value)}
                    placeholder="https://www.google.com/maps/embed?..."
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
                  activeBranchDraft?.status as
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
                isPublishing={isPublishing || isOwnerUpdating}
                onRevert={() => setFormValues(initialValues)}
                customActions={
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Save Draft Action (Marketer & Owner) */}
                    <form action={saveAction}>
                      <input type="hidden" name="id" value={activeBranchDraft?.id || ""} />
                      <input type="hidden" name="contentType" value="section" />
                      <input
                        type="hidden"
                        name="contentKey"
                        value={`branch_${currentBranch.id.replace(/-/g, "_")}`}
                      />
                      <input type="hidden" name="title" value={formValues.name} />
                      <input type="hidden" name="subtitle" value={formValues.openingHours} />
                      <input type="hidden" name="body" value={formValues.address} />
                      <input type="hidden" name="ctaLabel" value={formValues.phone} />
                      <input type="hidden" name="imageUrl" value={formValues.imageUrl} />
                      <input
                        type="hidden"
                        name="metadata"
                        value={JSON.stringify({
                          branchId: currentBranch.id,
                          name: formValues.name,
                          address: formValues.address,
                          phone: formValues.phone,
                          email: formValues.email,
                          fbPage: formValues.fbPage,
                          messengerLink: formValues.messengerLink,
                          openingHours: formValues.openingHours,
                          mapsEmbedUrl: formValues.mapsEmbedUrl,
                          imageUrl: formValues.imageUrl,
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
                    {activeBranchDraft &&
                      ["draft", "changes_requested"].includes(activeBranchDraft.status) && (
                        <form action={submitAction}>
                          <input type="hidden" name="id" value={activeBranchDraft.id} />
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

                    {/* Owner Direct Update / Canonical Publish */}
                    {role === "owner" && (
                      <>
                        {activeBranchDraft &&
                        ["submitted", "approved"].includes(activeBranchDraft.status) ? (
                          <form action={publishAction}>
                            <input type="hidden" name="id" value={activeBranchDraft.id} />
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
                          <form action={ownerUpdateAction}>
                            <input type="hidden" name="branchId" value={currentBranch.id} />
                            <input type="hidden" name="name" value={formValues.name} />
                            <input type="hidden" name="address" value={formValues.address} />
                            <input type="hidden" name="phone" value={formValues.phone} />
                            <input type="hidden" name="email" value={formValues.email} />
                            <input type="hidden" name="fbPage" value={formValues.fbPage} />
                            <input
                              type="hidden"
                              name="messengerLink"
                              value={formValues.messengerLink}
                            />
                            <input
                              type="hidden"
                              name="openingHours"
                              value={formValues.openingHours}
                            />
                            <input
                              type="hidden"
                              name="mapsEmbedUrl"
                              value={formValues.mapsEmbedUrl}
                            />
                            <input type="hidden" name="imageUrl" value={formValues.imageUrl} />
                            <button
                              type="submit"
                              disabled={isOwnerUpdating}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
                              {isOwnerUpdating ? "Updating..." : "Update Live Branch"}
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

        {/* Right Column: Public Card Live Preview (Dark Spa Visual Standard) */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/95 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#C8A96B]" />
                <h3 className="text-sm font-medium text-[#F6EBD6]">Public Branch Card Preview</h3>
              </div>
              <span className="text-[11px] text-[#9AA89A]">Matches /branches & /contact</span>
            </div>

            {/* Simulated Public Branch Card */}
            <div className="mt-5 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#D4B57A]/25 bg-[#0D2B20]/90 p-6 shadow-2xl backdrop-blur-xl">
                {/* Photo */}
                <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-[#031B16]">
                  {formValues.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formValues.imageUrl}
                      alt={formValues.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#9AA89A]">
                      <Building2 className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full bg-[#10261D]/80 px-3 py-1 text-[11px] font-semibold text-[#C8A96B] backdrop-blur-md">
                    {currentBranch.name.toLowerCase().includes("sm")
                      ? "Mall Location"
                      : "Flagship Sanctuary"}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#163A2B] text-[#C8A96B] shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <h4
                      className="text-xl font-medium text-[#F6EBD6]"
                      style={{ fontFamily: "var(--sp-font-display)" }}
                    >
                      {formValues.name || "Branch Name"}
                    </h4>
                  </div>

                  {formValues.address && (
                    <p className="text-xs leading-relaxed text-[#F6EBD6]/80 pl-10.5">
                      {formValues.address}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 pl-10.5 text-xs text-[#F6EBD6]/70">
                    {formValues.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[#C8A96B]" />
                        <span>{formValues.phone}</span>
                      </div>
                    )}
                    {formValues.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-[#C8A96B]" />
                        <span>{formValues.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#C8A96B]" />
                      <span>{formValues.openingHours || "Open Daily"}</span>
                    </div>
                  </div>

                  {/* Action links */}
                  <div className="flex flex-wrap gap-2.5 pt-3 pl-10.5 border-t border-white/5">
                    {formValues.phone && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#D4B57A]/30 bg-transparent px-3 py-1 text-[11px] text-[#F6EBD6]">
                        <Phone className="h-3 w-3 text-[#C8A96B]" />
                        Call {formValues.phone}
                      </span>
                    )}
                    {formValues.messengerLink && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-300">
                        <MessageCircle className="h-3 w-3 text-blue-400" />
                        Messenger
                      </span>
                    )}
                    {formValues.fbPage && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-[#9AA89A]">
                        <Globe className="h-3 w-3" />
                        Facebook
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header/Footer Impact Note */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-[#9AA89A] space-y-2">
                <p className="font-semibold text-[#C8A96B]">Public Consumer Impact:</p>
                <p>
                  Updates to this branch immediately update the public{" "}
                  <code className="text-[#F6EBD6]">/branches</code> directory,{" "}
                  <code className="text-[#F6EBD6]">/contact</code> cards, and{" "}
                  <code className="text-[#F6EBD6]">SiteFooter</code> contact schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
