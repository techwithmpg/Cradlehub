"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  ImageIcon,
  Laptop,
  Layers,
  Save,
  Search,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { MarketingBrandSettingRow } from "@/lib/queries/marketing-brand";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type { Database } from "@/types/supabase";
import {
  PUBLIC_IMAGE_SLOTS,
  buildDynamicPublicImageSlots,
  extractManagedSlotsFromMetadata,
  isActiveMarketingDraft,
  resolveSlotState,
  type PublicImageSlot,
  type SlotResolution,
} from "@/lib/marketing/website-images-inventory";
import {
  UniversalMediaPicker,
  type SelectedMediaValue,
} from "@/components/features/marketing/media/universal-media-picker";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
  type MarketingDraftActionState,
} from "@/app/(dashboard)/marketing/actions";
import {
  approveMarketingDraftAction,
  archiveMarketingDraftAction,
  publishMarketingDraftAction,
  type MarketingActionState,
} from "@/app/(dashboard)/owner/marketing/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type WebsiteImagesViewProps = {
  role: "digital_marketer" | "owner";
  sectionDefaults?: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  drafts: MarketingContentDraftRow[];
  revisions?: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  brandSettings?: MarketingBrandSettingRow[];
  branches?: BranchRow[];
  services?: PublicCatalogService[];
  onNavigateTab?: (tab: "website" | "brand" | "branches" | "services" | "media") => void;
};

type PendingSelection = {
  slotId: string;
  url: string;
  altText: string;
  title?: string;
};

function actionFeedback(
  result: { success?: boolean; error?: string; message?: string },
  successMessage: string
): { type: "success" | "error"; message: string } {
  return result.success
    ? { type: "success", message: result.message || successMessage }
    : { type: "error", message: result.error || "Action failed." };
}

export function WebsiteImagesView({
  role,
  publishedSections,
  drafts,
  mediaAssets = [],
  brandSettings = [],
  branches = [],
  services = [],
  onNavigateTab,
}: WebsiteImagesViewProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [pageFilter, setPageFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  // In-memory pending image selections before Save Draft is clicked
  const [pendingSelections, setPendingSelections] = useState<Record<string, PendingSelection>>({});

  // Universal Media Picker modal state
  const [activePickerSlot, setActivePickerSlot] = useState<PublicImageSlot | null>(null);

  // Preview Modal state
  const [previewSlot, setPreviewSlot] = useState<PublicImageSlot | null>(null);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");

  // Local feedback message
  const [localFeedback, setLocalFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Server Actions
  const [saveState, saveAction, isSaving] = useActionState(
    async (previousState: MarketingDraftActionState, formData: FormData) => {
      const slotId = String(formData.get("clientSlotId") ?? "");
      const selectedUrl = String(formData.get("clientSelectedUrl") ?? "");
      const result = await saveMarketingDraftAction(previousState, formData);
      setLocalFeedback(actionFeedback(result, "Draft image saved."));
      if (result.success && slotId) {
        setPendingSelections((previous) => {
          if (previous[slotId]?.url !== selectedUrl) return previous;
          const next = { ...previous };
          delete next[slotId];
          return next;
        });
      }
      return result;
    },
    {}
  );
  const [submitState, submitAction, isSubmitting] = useActionState(
    async (previousState: MarketingDraftActionState, formData: FormData) => {
      const result = await submitMarketingDraftAction(previousState, formData);
      setLocalFeedback(actionFeedback(result, "Draft submitted for Owner review."));
      return result;
    },
    {}
  );
  const [approveState, approveAction, isApproving] = useActionState(
    async (previousState: MarketingActionState, formData: FormData) => {
      const result = await approveMarketingDraftAction(previousState, formData);
      setLocalFeedback(actionFeedback(result, "Draft approved."));
      return result;
    },
    {}
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    async (previousState: MarketingActionState, formData: FormData) => {
      const result = await publishMarketingDraftAction(previousState, formData);
      setLocalFeedback(actionFeedback(result, "Draft published."));
      return result;
    },
    {}
  );
  const [archiveState, archiveAction, isArchiving] = useActionState(
    async (previousState: MarketingActionState, formData: FormData) => {
      const result = await archiveMarketingDraftAction(previousState, formData);
      setLocalFeedback(actionFeedback(result, "Draft archived."));
      return result;
    },
    {}
  );

  // Build complete slots list (static slots + dynamic branch & service slots)
  const allSlots = useMemo(() => {
    const dynamicSlots = buildDynamicPublicImageSlots({ branches, services });
    return [...PUBLIC_IMAGE_SLOTS, ...dynamicSlots];
  }, [branches, services]);

  // Combine initial drafts with recent action outcomes
  const effectiveDrafts = useMemo(() => {
    let list = [...drafts];
    if (saveState.success && saveState.draft) {
      const saved = saveState.draft;
      const idx = list.findIndex(
        (d) =>
          d.id === saved.id ||
          (d.content_type === saved.content_type && d.content_key === saved.content_key)
      );
      if (idx >= 0) list[idx] = saved;
      else list = [saved, ...list];
    }
    if (submitState.success && submitState.draft) {
      const sub = submitState.draft;
      const idx = list.findIndex((d) => d.id === sub.id);
      if (idx >= 0) list[idx] = sub;
      else list = [sub, ...list];
    }
    if (approveState.success && approveState.draft) {
      const app = approveState.draft;
      const idx = list.findIndex((d) => d.id === app.id);
      if (idx >= 0) list[idx] = app;
      else list = [app, ...list];
    }
    if (publishState.success && publishState.draft) {
      const pub = publishState.draft;
      const idx = list.findIndex((d) => d.id === pub.id);
      if (idx >= 0) list[idx] = pub;
      else list = [pub, ...list];
    }
    if (archiveState.success && archiveState.draft) {
      const arch = archiveState.draft;
      const idx = list.findIndex((d) => d.id === arch.id);
      if (idx >= 0) list[idx] = arch;
      else list = [arch, ...list];
    }
    return list;
  }, [drafts, saveState, submitState, approveState, publishState, archiveState]);

  // Resolve state for every slot
  const slotResolutions = useMemo(() => {
    const map = new Map<string, SlotResolution>();
    for (const slot of allSlots) {
      const res = resolveSlotState({
        slot,
        publishedSections,
        drafts: effectiveDrafts,
        brandSettings,
        branches,
        services,
      });
      map.set(slot.id, res);
    }
    return map;
  }, [allSlots, publishedSections, effectiveDrafts, brandSettings, branches, services]);

  const feedback = localFeedback;

  // Handle image selected from UniversalMediaPicker
  const handleSelectMedia = (slot: PublicImageSlot, selected: SelectedMediaValue) => {
    setPendingSelections((prev) => ({
      ...prev,
      [slot.id]: {
        slotId: slot.id,
        url: selected.publicUrl,
        altText: selected.altText || slot.label,
        title: selected.title ?? undefined,
      },
    }));
    setActivePickerSlot(null);
    setLocalFeedback({
      type: "success",
      message: `Image selected for "${slot.label}". Click "Save Draft" to persist your changes. Live website is unchanged.`,
    });
  };

  // Discard pending in-memory selection
  const handleDiscardPending = (slotId: string) => {
    setPendingSelections((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setLocalFeedback({
      type: "success",
      message: "Pending selection discarded.",
    });
  };

  // Build FormData and submit draft for a slot
  const handleSaveDraftForSlot = (slot: PublicImageSlot) => {
    const pending = pendingSelections[slot.id];
    const resolution = slotResolutions.get(slot.id);
    const targetUrl = pending ? pending.url : resolution?.effectiveUrl;

    if (!targetUrl || slot.canonicalOwner !== "website") return;

    const formData = new FormData();

    if (slot.fieldKey === "managedSlot") {
      // Slot maps to the centralized 'site_images' managed section
      const slotKey = slot.slotKey || slot.id;
      const siteImagesSection = publishedSections.find((s) => s.section_key === "site_images");
      const siteImagesDraft = effectiveDrafts.find(
        (d) =>
          d.content_type === "section" &&
          d.content_key === "site_images" &&
          isActiveMarketingDraft(d)
      );

      formData.append("id", siteImagesDraft?.id ?? "");
      formData.append("contentType", "section");
      formData.append("contentKey", "site_images");
      formData.append(
        "title",
        siteImagesDraft?.title ?? siteImagesSection?.title ?? "Website Managed Images"
      );
      formData.append(
        "subtitle",
        siteImagesDraft?.subtitle ??
          siteImagesSection?.subtitle ??
          "Centralized public image configurations and visual placements"
      );
      formData.append("isEnabled", "on");
      formData.append(
        "sortOrder",
        String(siteImagesDraft?.sort_order ?? siteImagesSection?.sort_order ?? 100)
      );

      // Keep only this draft's changes; published slots are merged at publish time.
      const currentDraftMeta = (siteImagesDraft?.metadata ?? {}) as Record<string, unknown>;
      const currentSlots = {
        ...extractManagedSlotsFromMetadata(currentDraftMeta),
        [slotKey]: targetUrl,
      };

      formData.append(
        "metadataJson",
        JSON.stringify({
          ...currentDraftMeta,
          slots: currentSlots,
        })
      );
    } else {
      // Section field (hero, about, signature_services, etc.)
      const sectionKey = slot.targetSectionKey || "hero";
      const existingSection = publishedSections.find((s) => s.section_key === sectionKey);
      const existingDraft = effectiveDrafts.find(
        (d) =>
          d.content_type === "section" && d.content_key === sectionKey && isActiveMarketingDraft(d)
      );

      formData.append("id", existingDraft?.id ?? "");
      formData.append("contentType", "section");
      formData.append("contentKey", sectionKey);
      formData.append("title", existingDraft?.title ?? existingSection?.title ?? "");
      formData.append("subtitle", existingDraft?.subtitle ?? existingSection?.subtitle ?? "");
      formData.append("body", existingDraft?.body ?? existingSection?.body ?? "");
      formData.append("ctaLabel", existingDraft?.cta_label ?? existingSection?.cta_label ?? "");
      formData.append("ctaHref", existingDraft?.cta_href ?? existingSection?.cta_href ?? "");

      formData.append(
        "imageUrl",
        slot.fieldKey === "imageUrl"
          ? targetUrl
          : (existingDraft?.image_url ?? existingSection?.image_url ?? "")
      );
      formData.append(
        "secondaryImageUrl",
        slot.fieldKey === "secondaryImageUrl"
          ? targetUrl
          : (existingDraft?.secondary_image_url ?? existingSection?.secondary_image_url ?? "")
      );

      formData.append(
        "altText",
        slot.fieldKey === "mobileImageUrl" || slot.fieldKey === "categoryImage"
          ? (existingDraft?.alt_text ?? "")
          : pending?.altText || existingDraft?.alt_text || slot.label
      );
      formData.append(
        "sortOrder",
        String(existingDraft?.sort_order ?? existingSection?.sort_order ?? 0)
      );
      if (existingDraft?.is_enabled ?? existingSection?.is_enabled ?? true) {
        formData.append("isEnabled", "on");
      }

      const currentMeta = (existingDraft?.metadata ?? existingSection?.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const nextMeta = { ...currentMeta };

      if (slot.fieldKey === "categoryImage" && slot.categoryName) {
        const catImages = {
          ...((currentMeta.categoryImages as Record<string, string>) || {}),
          [slot.categoryName]: targetUrl,
        };
        nextMeta.categoryImages = catImages;
      }
      if (slot.fieldKey === "mobileImageUrl") {
        nextMeta.mobileImageUrl = targetUrl;
        nextMeta.mobileImageAltText = pending?.altText || slot.label;
      }

      formData.append("metadataJson", JSON.stringify(nextMeta));
    }

    // Call server action
    formData.append("clientSlotId", slot.id);
    formData.append("clientSelectedUrl", targetUrl);
    startTransition(() => saveAction(formData));
  };

  // Restore Default Asset action
  const handleRestoreDefault = (slot: PublicImageSlot) => {
    setPendingSelections((prev) => ({
      ...prev,
      [slot.id]: {
        slotId: slot.id,
        url: slot.defaultUrl,
        altText: slot.label,
      },
    }));
    setLocalFeedback({
      type: "success",
      message: `Default image staged for "${slot.label}". Click "Save Draft" to persist.`,
    });
  };

  // Filter and search slots
  const filteredSlots = useMemo(() => {
    return allSlots.filter((slot) => {
      const resolution = slotResolutions.get(slot.id);
      const pending = pendingSelections[slot.id];
      const isDraftStatus =
        resolution?.status === "draft" ||
        resolution?.status === "pending_review" ||
        resolution?.status === "approved" ||
        resolution?.status === "changes_requested";

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesLabel = slot.label.toLowerCase().includes(query);
        const matchesDesc = slot.description.toLowerCase().includes(query);
        const matchesPage = slot.page.toLowerCase().includes(query);
        const matchesSection = slot.section.toLowerCase().includes(query);
        const matchesId = slot.id.toLowerCase().includes(query);
        if (!matchesLabel && !matchesDesc && !matchesPage && !matchesSection && !matchesId) {
          return false;
        }
      }

      // Page filter
      if (pageFilter !== "all" && slot.page !== pageFilter) return false;

      // Device filter
      if (deviceFilter !== "all") {
        if (
          deviceFilter === "desktop" &&
          slot.deviceUsage !== "desktop" &&
          slot.deviceUsage !== "both"
        ) {
          return false;
        }
        if (
          deviceFilter === "mobile" &&
          slot.deviceUsage !== "mobile" &&
          slot.deviceUsage !== "both"
        ) {
          return false;
        }
      }

      // Owner filter
      if (ownerFilter !== "all") {
        if (ownerFilter === "website") {
          if (slot.canonicalOwner !== "website") return false;
        } else if (slot.canonicalOwner !== ownerFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending_unsaved" && !pending) return false;
        if (statusFilter === "has_draft" && !isDraftStatus && !pending) return false;
        if (statusFilter === "published" && (isDraftStatus || pending)) return false;
        if (statusFilter === "customized" && !resolution?.isCustom && !pending) return false;
        if (statusFilter === "default" && resolution?.isCustom) return false;
      }

      return true;
    });
  }, [
    allSlots,
    slotResolutions,
    pendingSelections,
    searchQuery,
    pageFilter,
    deviceFilter,
    ownerFilter,
    statusFilter,
  ]);

  // Group slots by Page
  const groupedSlots = useMemo(() => {
    const pages: Record<string, PublicImageSlot[]> = {};
    for (const slot of filteredSlots) {
      const list = pages[slot.page] ?? [];
      list.push(slot);
      pages[slot.page] = list;
    }
    return pages;
  }, [filteredSlots]);

  // Statistics
  const stats = useMemo(() => {
    const total = allSlots.length;
    let directlyManaged = 0;
    let externalStudio = 0;
    let activeDraftCount = 0;
    let customizedCount = 0;

    for (const slot of allSlots) {
      const res = slotResolutions.get(slot.id);
      if (slot.canonicalOwner !== "website") externalStudio++;
      else directlyManaged++;

      const isDraftStatus =
        res?.status === "draft" ||
        res?.status === "pending_review" ||
        res?.status === "approved" ||
        res?.status === "changes_requested";

      if (isDraftStatus || pendingSelections[slot.id]) activeDraftCount++;
      if (res?.isCustom || pendingSelections[slot.id]) customizedCount++;
    }

    return { total, directlyManaged, externalStudio, activeDraftCount, customizedCount };
  }, [allSlots, slotResolutions, pendingSelections]);

  const uniquePages = useMemo(() => {
    return Array.from(new Set(allSlots.map((s) => s.page)));
  }, [allSlots]);

  return (
    <div className="space-y-6">
      {/* ── KPI & Summary Bar ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--cs-text-secondary)]">
            <span className="font-medium">Total Visual Placements</span>
            <ImageIcon className="h-4 w-4 text-[var(--cs-primary)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--cs-text)]">{stats.total}</span>
            <span className="text-xs text-[var(--cs-text-secondary)]">slots inventoried</span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--cs-text-secondary)]">
            <span className="font-medium">Direct Website Images</span>
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {stats.directlyManaged}
            </span>
            <span className="text-xs text-[var(--cs-text-secondary)]">managed right here</span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--cs-text-secondary)]">
            <span className="font-medium">Studio Integrated</span>
            <ExternalLink className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.externalStudio}
            </span>
            <span className="text-xs text-[var(--cs-text-secondary)]">
              Brand, Services, Branches
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--cs-text-secondary)]">
            <span className="font-medium">Active Drafts</span>
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {stats.activeDraftCount}
            </span>
            <span className="text-xs text-[var(--cs-text-secondary)]">in review / staging</span>
          </div>
        </div>
      </div>

      {/* ── Feedback Notification ─────────────────────────────────── */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3.5 text-xs animate-in fade-in ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalFeedback(null)}
            className="p-1 hover:opacity-75 focus:outline-none"
            aria-label="Dismiss feedback"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Filter & Search Toolbar ───────────────────────────────── */}
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative min-w-[280px] flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--cs-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by placement, label, page, or slot ID..."
              className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] py-2 pl-9 pr-3 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-primary)] focus:bg-[var(--cs-surface)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Page Filter */}
            <select
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1.5 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
            >
              <option value="all">All Pages ({allSlots.length})</option>
              {uniquePages.map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>

            {/* Device Filter */}
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1.5 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
            >
              <option value="all">All Devices</option>
              <option value="desktop">Desktop Placements</option>
              <option value="mobile">Mobile Placements</option>
            </select>

            {/* Ownership Filter */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1.5 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
            >
              <option value="all">All Ownership</option>
              <option value="website">Managed in Website Images</option>
              <option value="brand">Brand Studio Owned</option>
              <option value="services">Services Studio Owned</option>
              <option value="branches">Branches Studio Owned</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1.5 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
            >
              <option value="all">All Statuses</option>
              <option value="pending_unsaved">Unsaved Selection</option>
              <option value="has_draft">Active Drafts</option>
              <option value="published">Published Live</option>
              <option value="customized">Customized</option>
              <option value="default">Default Asset</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--cs-text-secondary)]">
          <span>
            Showing <strong className="text-[var(--cs-text)]">{filteredSlots.length}</strong> of{" "}
            {allSlots.length} public placements
          </span>
          {Object.keys(pendingSelections).length > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {Object.keys(pendingSelections).length} unsaved selection(s) staging
            </span>
          )}
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────────── */}
      {filteredSlots.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-[var(--cs-text-secondary)] opacity-50" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--cs-text)]">
            No image placements match your filters
          </h3>
          <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
            Try adjusting your search terms, device, or ownership filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setPageFilter("all");
              setDeviceFilter("all");
              setStatusFilter("all");
              setOwnerFilter("all");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text)]"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ── Grouped Slots Grid by Page ────────────────────────────── */}
      <div className="space-y-8">
        {Object.entries(groupedSlots).map(([pageName, slots]) => (
          <div key={pageName} className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--cs-border)] pb-2">
              <Globe className="h-4 w-4 text-[var(--cs-primary)]" />
              <h2 className="text-sm font-bold text-[var(--cs-text)]">{pageName}</h2>
              <span className="rounded-full bg-[var(--cs-surface-warm)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cs-text-secondary)]">
                {slots.length} {slots.length === 1 ? "placement" : "placements"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => {
                const resolution = slotResolutions.get(slot.id);
                const pending = pendingSelections[slot.id];
                const activeDraft = resolution?.draftId
                  ? effectiveDrafts.find((d) => d.id === resolution.draftId)
                  : undefined;

                // Currently displayed image (pending > effective > default)
                const displayUrl = pending?.url || resolution?.effectiveUrl || slot.defaultUrl;
                const isPending = Boolean(pending);
                const isDraftStatus =
                  resolution?.status === "draft" ||
                  resolution?.status === "pending_review" ||
                  resolution?.status === "approved" ||
                  resolution?.status === "changes_requested";
                const isOwner = role === "owner";

                return (
                  <div
                    key={slot.id}
                    className={`flex flex-col justify-between rounded-xl border bg-[var(--cs-surface)] p-4 shadow-xs transition-all ${
                      isPending
                        ? "border-amber-300 ring-2 ring-amber-300/40 dark:border-amber-700"
                        : isDraftStatus
                          ? "border-purple-300 dark:border-purple-800"
                          : "border-[var(--cs-border)] hover:border-[var(--cs-primary)]/40"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <span className="font-semibold text-[var(--cs-text-secondary)]">
                          {slot.section}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Device badge */}
                          {slot.deviceUsage === "desktop" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                              <Laptop className="h-3 w-3" /> Desktop
                            </span>
                          ) : slot.deviceUsage === "mobile" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                              <Smartphone className="h-3 w-3" /> Mobile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                              Responsive
                            </span>
                          )}

                          {/* Ownership badge */}
                          {slot.canonicalOwner !== "website" ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              {slot.canonicalOwner} Studio
                            </span>
                          ) : (
                            <span className="rounded bg-purple-50 px-1.5 py-0.5 font-bold uppercase text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                              Website
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Image Thumbnail Container */}
                      <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)]">
                        <Image
                          src={displayUrl}
                          alt={slot.label}
                          fill
                          sizes="(max-width: 640px) 100vw, 360px"
                          className="object-cover transition duration-300 group-hover:scale-105"
                          unoptimized={displayUrl.startsWith("http")}
                        />

                        {/* Status overlays */}
                        <div className="absolute left-2 top-2 flex flex-col gap-1">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                              Unsaved Selection
                            </span>
                          )}
                          {!isPending && isDraftStatus && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <Clock className="h-3 w-3" />
                              Draft ({resolution?.status})
                            </span>
                          )}
                          {!isPending && !isDraftStatus && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                              <Check className="h-3 w-3" /> Live Published
                            </span>
                          )}
                        </div>

                        {/* Preview button overlay on hover */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setPreviewSlot(slot)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-md backdrop-blur-xs transition hover:bg-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview Placement
                          </button>
                        </div>
                      </div>

                      {/* Placement Info */}
                      <div>
                        <h3 className="text-xs font-bold text-[var(--cs-text)] line-clamp-1">
                          {slot.label}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[var(--cs-text-secondary)] line-clamp-2 leading-relaxed">
                          {slot.description}
                        </p>
                      </div>

                      {/* Dimension and Format details */}
                      <div className="flex items-center justify-between text-[10px] text-[var(--cs-text-secondary)] border-t border-[var(--cs-border)]/60 pt-2">
                        <span>Aspect: {slot.aspectRatio}</span>
                        <span>Rec: {slot.recommendedDimensions}</span>
                      </div>

                      {/* Review note if changes requested */}
                      {activeDraft?.status === "changes_requested" && activeDraft.review_note && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                          <span className="font-bold">Review Note:</span> {activeDraft.review_note}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 border-t border-[var(--cs-border)] pt-3 space-y-2">
                      {slot.canonicalOwner !== "website" ? (
                        /* Canonical Studio Navigation Action */
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.(slot.canonicalOwner)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface)]"
                          >
                            <span>
                              Edit in{" "}
                              {slot.canonicalOwner.charAt(0).toUpperCase() +
                                slot.canonicalOwner.slice(1)}{" "}
                              Studio
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <p className="text-[10px] text-[var(--cs-text-secondary)] text-center">
                            Managed authoritatively in {slot.canonicalOwner} studio
                          </p>
                        </div>
                      ) : (
                        /* Website Managed Image Actions */
                        <div className="space-y-2">
                          {/* Main Change / Discard actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActivePickerSlot(slot)}
                              disabled={isSaving || isPublishing}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-[var(--cs-primary)]" />
                              <span>{isPending ? "Change Selection" : "Change Picture"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewSlot(slot)}
                              className="inline-flex items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-1.5 text-xs text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                              title="Preview in Context"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Pending Unsaved Staging controls */}
                          {isPending && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveDraftForSlot(slot)}
                                disabled={isSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--cs-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
                              >
                                <Save className="h-3.5 w-3.5" />
                                <span>{isSaving ? "Saving..." : "Save Draft"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDiscardPending(slot.id)}
                                className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300"
                              >
                                Discard
                              </button>
                            </div>
                          )}

                          {/* Existing Draft Actions */}
                          {!isPending && isDraftStatus && activeDraft && (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Digital Marketer Submit for Review */}
                                {role === "digital_marketer" &&
                                  activeDraft.status !== "submitted" && (
                                    <form action={submitAction} className="flex-1">
                                      <input type="hidden" name="id" value={activeDraft.id} />
                                      <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--cs-primary)] px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                        <span>Submit</span>
                                      </button>
                                    </form>
                                  )}

                                {/* Owner Approve / Publish */}
                                {isOwner && (
                                  <>
                                    {activeDraft.status !== "approved" && (
                                      <form action={approveAction} className="flex-1">
                                        <input type="hidden" name="id" value={activeDraft.id} />
                                        <button
                                          type="submit"
                                          disabled={isApproving}
                                          className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          <span>Approve</span>
                                        </button>
                                      </form>
                                    )}

                                    <form action={publishAction} className="flex-1">
                                      <input type="hidden" name="id" value={activeDraft.id} />
                                      <button
                                        type="submit"
                                        disabled={isPublishing}
                                        className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                                      >
                                        <Globe className="h-3.5 w-3.5" />
                                        <span>Publish</span>
                                      </button>
                                    </form>
                                  </>
                                )}
                              </div>

                              {/* Archiving affects the entire draft, including other managed slots. */}
                              <div className="flex items-center justify-between text-[11px]">
                                {isOwner && (
                                  <form
                                    action={archiveAction}
                                    onSubmit={(event) => {
                                      const scope =
                                        activeDraft.content_key === "site_images"
                                          ? "all unpublished Website Images changes"
                                          : "all unpublished changes in this section";
                                      if (
                                        !window.confirm(
                                          `Archive this entire draft and discard ${scope}?`
                                        )
                                      ) {
                                        event.preventDefault();
                                      }
                                    }}
                                  >
                                    <input type="hidden" name="id" value={activeDraft.id} />
                                    <button
                                      type="submit"
                                      disabled={isArchiving}
                                      className="text-stone-500 hover:text-stone-800 underline dark:text-stone-400"
                                    >
                                      Archive Entire Draft
                                    </button>
                                  </form>
                                )}

                                {resolution?.isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreDefault(slot)}
                                    className="text-stone-500 hover:text-stone-800 underline dark:text-stone-400"
                                  >
                                    Restore Default
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* No Draft, Live Published: option to Restore Default if customized */}
                          {!isPending && !isDraftStatus && resolution?.isCustom && (
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => handleRestoreDefault(slot)}
                                className="text-[11px] text-stone-500 hover:text-stone-800 underline dark:text-stone-400"
                              >
                                Restore Original Default
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Universal Media Picker Modal ──────────────────────────── */}
      {activePickerSlot && (
        <UniversalMediaPicker
          isOpen={true}
          onClose={() => setActivePickerSlot(null)}
          onSelect={(selected) => handleSelectMedia(activePickerSlot, selected)}
          currentUrl={
            pendingSelections[activePickerSlot.id]?.url ||
            slotResolutions.get(activePickerSlot.id)?.effectiveUrl
          }
          title={`Select Image for: ${activePickerSlot.label}`}
          availableAssets={mediaAssets}
          filterSectionKey={activePickerSlot.targetSectionKey || "site_images"}
        />
      )}

      {/* ── High-Fidelity Placement Preview Modal ─────────────────── */}
      {previewSlot && (
        <Dialog open={true} onOpenChange={(open) => !open && setPreviewSlot(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="text-base font-bold text-[var(--cs-text)]">
                    {previewSlot.label} — Placement Preview
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[var(--cs-text-secondary)]">
                    {previewSlot.page} • {previewSlot.section} ({previewSlot.deviceUsage} placement)
                  </DialogDescription>
                </div>

                {/* Desktop / Mobile toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("desktop")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      previewViewport === "desktop"
                        ? "bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-white"
                        : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
                    }`}
                  >
                    <Laptop className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("mobile")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      previewViewport === "mobile"
                        ? "bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-white"
                        : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Mobile
                  </button>
                </div>
              </div>
            </DialogHeader>

            {/* Preview Frame Container */}
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--cs-text-secondary)]">
                <span>
                  Aspect Ratio:{" "}
                  <strong className="text-[var(--cs-text)]">{previewSlot.aspectRatio}</strong>
                </span>
                <span>
                  Recommended:{" "}
                  <strong className="text-[var(--cs-text)]">
                    {previewSlot.recommendedDimensions}
                  </strong>
                </span>
              </div>

              {/* Contextual Container Frame */}
              <div
                className={`mx-auto overflow-hidden rounded-2xl border border-stone-800 bg-[#10261D] shadow-2xl transition-all ${
                  previewViewport === "mobile" ? "max-w-[375px]" : "w-full"
                }`}
              >
                {/* Simulated browser/device header bar */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#0A1A13] px-4 py-2 text-[11px] text-white/60">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="font-mono text-[10px] text-white/40">
                    cradlewellnessliving.com
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-[#C8A96B]">
                    {previewViewport}
                  </span>
                </div>

                {/* Simulated Placement Viewport */}
                <div className="relative aspect-video w-full overflow-hidden bg-stone-900">
                  <Image
                    src={
                      pendingSelections[previewSlot.id]?.url ||
                      slotResolutions.get(previewSlot.id)?.effectiveUrl ||
                      previewSlot.defaultUrl
                    }
                    alt={previewSlot.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {/* Subtle brand overlay guide */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#10261D]/80 via-transparent to-transparent flex items-end p-6">
                    <div className="max-w-md">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A96B]">
                        Live Placement Preview
                      </span>
                      <h4
                        className="mt-1 text-lg font-medium text-white"
                        style={{ fontFamily: "serif" }}
                      >
                        {previewSlot.label}
                      </h4>
                      <p className="mt-1 text-xs text-white/70 line-clamp-2">
                        {previewSlot.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side-by-side comparison (Live Published vs Active/Staged) */}
              <div className="grid gap-3 pt-4 border-t border-[var(--cs-border)] sm:grid-cols-2 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-[var(--cs-text)]">Live Published Asset:</span>
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)]">
                    <Image
                      src={
                        slotResolutions.get(previewSlot.id)?.publishedUrl || previewSlot.defaultUrl
                      }
                      alt="Current live image"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--cs-text-secondary)] truncate">
                    URL:{" "}
                    {slotResolutions.get(previewSlot.id)?.publishedUrl || previewSlot.defaultUrl}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-[var(--cs-text)]">
                    Draft / Selected Staged Asset:
                  </span>
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-purple-300 dark:border-purple-800 bg-[var(--cs-surface-warm)]">
                    <Image
                      src={
                        pendingSelections[previewSlot.id]?.url ||
                        slotResolutions.get(previewSlot.id)?.effectiveUrl ||
                        previewSlot.defaultUrl
                      }
                      alt="Draft or staged image"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 truncate">
                    URL:{" "}
                    {pendingSelections[previewSlot.id]?.url ||
                      slotResolutions.get(previewSlot.id)?.effectiveUrl ||
                      previewSlot.defaultUrl}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border)] pt-4">
              <button
                type="button"
                onClick={() => setPreviewSlot(null)}
                className="rounded-lg border border-[var(--cs-border)] px-4 py-2 text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
              >
                Close Preview
              </button>

              {previewSlot.canonicalOwner === "website" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const slot = previewSlot;
                      setPreviewSlot(null);
                      setActivePickerSlot(slot);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cs-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Change This Picture
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
