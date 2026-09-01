"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Layout,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  X,
} from "lucide-react";
import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { Database } from "@/types/supabase";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import {
  approveMarketingDraftAction,
  archiveMarketingDraftAction,
  publishMarketingDraftAction,
  requestMarketingDraftChangesAction,
  scheduleMarketingDraftAction,
} from "@/app/(dashboard)/owner/marketing/actions";
import { SectionEditor, type SectionFormValues } from "./section-editor";
import { HighFidelityPreview } from "./high-fidelity-preview";
import { RevertToLiveDialog, UnsavedChangesDialog } from "./unsaved-changes-dialog";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type WebsiteStudioViewProps = {
  role: "digital_marketer" | "owner";
  sectionDefaults: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  galleryAssets?: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions?: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  branches?: BranchRow[];
  services?: PublicCatalogService[];
};

type SectionNavItem = {
  key: string;
  label: string;
  category: "managed" | "gates" | "static";
  description: string;
};

const SECTION_NAVIGATION_ITEMS: readonly SectionNavItem[] = [
  // Category A: Managed
  {
    key: "hero",
    label: "Hero Header",
    category: "managed",
    description: "Main copy, CTAs, and background images",
  },
  {
    key: "about",
    label: "About & Philosophy",
    category: "managed",
    description: "Spa story and philosophy copy",
  },
  {
    key: "quote_banner",
    label: "Promotion / Quote Banner",
    category: "managed",
    description: "Full-width promotional banner",
  },
  {
    key: "before_you_book",
    label: "Before You Book",
    category: "managed",
    description: "Guest guidance checklist and tips",
  },
  // Category B: Display Gates
  {
    key: "signature_services",
    label: "Signature Services",
    category: "gates",
    description: "Homepage service catalog banner & visibility",
  },
  {
    key: "gallery",
    label: "Photo Gallery",
    category: "gates",
    description: "Homepage gallery showcase visibility",
  },
  // Category C: Static Components
  {
    key: "experience",
    label: "Cradle Experience",
    category: "static",
    description: "4-step journey (Static context)",
  },
  {
    key: "choose_setting",
    label: "Choose Setting",
    category: "static",
    description: "In-Spa vs Home Service (Static context)",
  },
  {
    key: "trust_points",
    label: "Why Choose Cradle",
    category: "static",
    description: "Trust points (Static context)",
  },
  {
    key: "team",
    label: "Wellness Team",
    category: "static",
    description: "Therapists showcase (Static context)",
  },
  {
    key: "reasons",
    label: "Reasons Guests Visit",
    category: "static",
    description: "Care scenarios (Static context)",
  },
  {
    key: "contact_presentation",
    label: "Branch Contact",
    category: "static",
    description: "Live branch details (Static context)",
  },
] as const;

function metadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getInitialFormValues(
  sectionKey: string,
  drafts: MarketingContentDraftRow[],
  publishedSections: PublicSiteSectionRow[],
  sectionDefaults: readonly MarketingSectionDefault[]
): SectionFormValues {
  const draft = drafts.find((d) => d.content_type === "section" && d.content_key === sectionKey);
  const published = publishedSections.find((s) => s.section_key === sectionKey);
  const fallback = sectionDefaults.find((d) => d.sectionKey === sectionKey);

  return {
    sectionKey,
    title: draft?.title ?? published?.title ?? fallback?.title ?? "",
    subtitle: draft?.subtitle ?? published?.subtitle ?? fallback?.subtitle ?? "",
    body: draft?.body ?? published?.body ?? fallback?.body ?? "",
    ctaLabel: draft?.cta_label ?? published?.cta_label ?? fallback?.ctaLabel ?? "",
    ctaHref: draft?.cta_href ?? published?.cta_href ?? fallback?.ctaHref ?? "",
    imageUrl: draft?.image_url ?? published?.image_url ?? fallback?.imageUrl ?? "",
    secondaryImageUrl:
      draft?.secondary_image_url ??
      published?.secondary_image_url ??
      fallback?.secondaryImageUrl ??
      "",
    altText: draft?.alt_text ?? "",
    linkHref: draft?.link_href ?? "",
    sortOrder: draft?.sort_order ?? published?.sort_order ?? fallback?.sortOrder ?? 0,
    isEnabled: draft?.is_enabled ?? published?.is_enabled ?? fallback?.isEnabled ?? true,
    metadata: {
      ...metadataObject(fallback?.metadata),
      ...metadataObject(published?.metadata),
      ...metadataObject(draft?.metadata),
    },
  };
}

function getLiveFormValues(
  sectionKey: string,
  publishedSections: PublicSiteSectionRow[],
  sectionDefaults: readonly MarketingSectionDefault[]
): SectionFormValues {
  const published = publishedSections.find((s) => s.section_key === sectionKey);
  const fallback = sectionDefaults.find((d) => d.sectionKey === sectionKey);

  return {
    sectionKey,
    title: published?.title ?? fallback?.title ?? "",
    subtitle: published?.subtitle ?? fallback?.subtitle ?? "",
    body: published?.body ?? fallback?.body ?? "",
    ctaLabel: published?.cta_label ?? fallback?.ctaLabel ?? "",
    ctaHref: published?.cta_href ?? fallback?.ctaHref ?? "",
    imageUrl: published?.image_url ?? fallback?.imageUrl ?? "",
    secondaryImageUrl: published?.secondary_image_url ?? fallback?.secondaryImageUrl ?? "",
    altText: "",
    linkHref: "",
    sortOrder: published?.sort_order ?? fallback?.sortOrder ?? 0,
    isEnabled: published?.is_enabled ?? fallback?.isEnabled ?? true,
    metadata: {
      ...metadataObject(fallback?.metadata),
      ...metadataObject(published?.metadata),
    },
  };
}

export function WebsiteStudioView({
  role,
  sectionDefaults,
  publishedSections,
  drafts,
  mediaAssets = [],
  branches = [],
  services = [],
}: WebsiteStudioViewProps) {
  const [activeSectionKey, setActiveSectionKey] = useState<string>("hero");
  const [pendingSectionKey, setPendingSectionKey] = useState<string | null>(null);

  // In-memory form state for the currently active section
  const [formState, setFormState] = useState<SectionFormValues>(() =>
    getInitialFormValues("hero", drafts, publishedSections, sectionDefaults)
  );

  // Dialog states
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState<boolean>(false);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState<boolean>(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState<boolean>(false);

  // Owner action modals
  const [ownerModal, setOwnerModal] = useState<"request_changes" | "schedule" | null>(null);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");

  // Local feedback notification (for client-only actions like Revert)
  const [localFeedback, setLocalFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Server actions
  const [saveState, saveAction, isSaving] = useActionState(saveMarketingDraftAction, {});
  const [submitState, submitAction, isSubmitting] = useActionState(submitMarketingDraftAction, {});

  const [approveState, approveAction, isApproving] = useActionState(
    approveMarketingDraftAction,
    {}
  );
  const [requestState, requestAction, isRequesting] = useActionState(
    requestMarketingDraftChangesAction,
    {}
  );
  const [scheduleState, scheduleAction, isScheduling] = useActionState(
    scheduleMarketingDraftAction,
    {}
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishMarketingDraftAction,
    {}
  );
  const [archiveState, archiveAction, isArchiving] = useActionState(
    archiveMarketingDraftAction,
    {}
  );

  // Derive effective drafts by applying recent server action results to initial drafts
  const effectiveDrafts = useMemo(() => {
    let list = [...drafts];
    if (saveState.success && saveState.draft) {
      const saved = saveState.draft;
      const idx = list.findIndex(
        (d) =>
          d.id === saved.id ||
          (d.content_type === saved.content_type && d.content_key === saved.content_key)
      );
      if (idx >= 0) {
        list[idx] = saved;
      } else {
        list = [saved, ...list];
      }
    }
    if (submitState.success && submitState.draft) {
      const submitted = submitState.draft;
      const idx = list.findIndex((d) => d.id === submitted.id);
      if (idx >= 0) {
        list[idx] = submitted;
      } else {
        list = [submitted, ...list];
      }
    }
    if (approveState.success && approveState.draft) {
      const approved = approveState.draft;
      const idx = list.findIndex((d) => d.id === approved.id);
      if (idx >= 0) {
        list[idx] = approved;
      } else {
        list = [approved, ...list];
      }
    }
    if (requestState.success && requestState.draft) {
      const req = requestState.draft;
      const idx = list.findIndex((d) => d.id === req.id);
      if (idx >= 0) {
        list[idx] = req;
      } else {
        list = [req, ...list];
      }
    }
    if (scheduleState.success && scheduleState.draft) {
      const sch = scheduleState.draft;
      const idx = list.findIndex((d) => d.id === sch.id);
      if (idx >= 0) {
        list[idx] = sch;
      } else {
        list = [sch, ...list];
      }
    }
    if (publishState.success && publishState.draft) {
      const pub = publishState.draft;
      const idx = list.findIndex((d) => d.id === pub.id);
      if (idx >= 0) {
        list[idx] = pub;
      } else {
        list = [pub, ...list];
      }
    }
    if (archiveState.success && archiveState.draft) {
      const arch = archiveState.draft;
      const idx = list.findIndex((d) => d.id === arch.id);
      if (idx >= 0) {
        list[idx] = arch;
      } else {
        list = [arch, ...list];
      }
    }
    return list;
  }, [
    drafts,
    saveState,
    submitState,
    approveState,
    requestState,
    scheduleState,
    publishState,
    archiveState,
  ]);

  // Current active draft for this section from effectiveDrafts
  const activeDraft = useMemo(
    () =>
      effectiveDrafts.find(
        (d) => d.content_type === "section" && d.content_key === activeSectionKey
      ),
    [effectiveDrafts, activeSectionKey]
  );

  // Baseline loaded values to calculate dirty state
  const baselineValues = useMemo(() => {
    return getInitialFormValues(
      activeSectionKey,
      effectiveDrafts,
      publishedSections,
      sectionDefaults
    );
  }, [activeSectionKey, effectiveDrafts, publishedSections, sectionDefaults]);

  // Determine if working editor has unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(baselineValues);
  }, [formState, baselineValues]);

  // Derived feedback from server actions or local state
  const feedback = useMemo(() => {
    if (saveState.message || saveState.error) {
      return saveState.success
        ? { type: "success" as const, message: saveState.message || "Draft saved." }
        : { type: "error" as const, message: saveState.error || "Save failed." };
    }
    if (submitState.message || submitState.error) {
      return submitState.success
        ? {
            type: "success" as const,
            message: submitState.message || "Draft submitted for owner review.",
          }
        : { type: "error" as const, message: submitState.error || "Submission failed." };
    }
    const res =
      approveState.message || approveState.error
        ? approveState
        : requestState.message || requestState.error
          ? requestState
          : scheduleState.message || scheduleState.error
            ? scheduleState
            : publishState.message || publishState.error
              ? publishState
              : archiveState.message || archiveState.error
                ? archiveState
                : null;

    if (res?.message || res?.error) {
      return res.success
        ? { type: "success" as const, message: res.message || "Action completed." }
        : { type: "error" as const, message: res.error || "Action failed." };
    }
    return localFeedback;
  }, [
    saveState,
    submitState,
    approveState,
    requestState,
    scheduleState,
    publishState,
    archiveState,
    localFeedback,
  ]);

  // Switch section with unsaved changes guard
  const handleSelectSection = (nextKey: string) => {
    if (nextKey === activeSectionKey) return;
    if (isDirty) {
      setPendingSectionKey(nextKey);
      setIsUnsavedDialogOpen(true);
    } else {
      setActiveSectionKey(nextKey);
      const nextValues = getInitialFormValues(
        nextKey,
        effectiveDrafts,
        publishedSections,
        sectionDefaults
      );
      setFormState(nextValues);
      setLocalFeedback(null);
    }
  };

  const handleDiscardAndNavigate = () => {
    if (pendingSectionKey) {
      setActiveSectionKey(pendingSectionKey);
      const nextValues = getInitialFormValues(
        pendingSectionKey,
        effectiveDrafts,
        publishedSections,
        sectionDefaults
      );
      setFormState(nextValues);
      setPendingSectionKey(null);
      setLocalFeedback(null);
    }
    setIsUnsavedDialogOpen(false);
  };

  const handleRevertConfirm = () => {
    const liveValues = getLiveFormValues(activeSectionKey, publishedSections, sectionDefaults);
    setFormState(liveValues);
    setIsRevertDialogOpen(false);
    setLocalFeedback({
      type: "success",
      message: `Reverted ${activeSectionKey} to live values in working editor. Click Save Draft to persist.`,
    });
  };

  // Construct High-Fidelity Preview Data
  // 1. Live published sections model
  const liveNormalizedSections = useMemo(
    () => resolvePublicSiteSections(publishedSections),
    [publishedSections]
  );

  // 2. Draft sections model (overlay drafts + current active editor in-memory state)
  const draftNormalizedSections = useMemo(() => {
    const baseRows = [...publishedSections];
    const sectionMap = new Map(baseRows.map((s) => [s.section_key, { ...s }]));

    // Apply existing drafts
    for (const d of drafts) {
      if (d.content_type === "section") {
        sectionMap.set(d.content_key, {
          id: d.source_section_id || `draft-${d.content_key}`,
          section_key: d.content_key,
          title: d.title,
          subtitle: d.subtitle,
          body: d.body,
          cta_label: d.cta_label,
          cta_href: d.cta_href,
          image_url: d.image_url,
          secondary_image_url: d.secondary_image_url,
          sort_order: d.sort_order,
          is_enabled: d.is_enabled,
          metadata:
            d.metadata as Database["public"]["Tables"]["public_site_sections"]["Row"]["metadata"],
          created_at: d.created_at,
          updated_at: d.updated_at,
        });
      }
    }

    // Overlay current in-memory form values for active section
    sectionMap.set(formState.sectionKey, {
      id: activeDraft?.source_section_id || `editor-${formState.sectionKey}`,
      section_key: formState.sectionKey,
      title: formState.title,
      subtitle: formState.subtitle,
      body: formState.body,
      cta_label: formState.ctaLabel,
      cta_href: formState.ctaHref,
      image_url: formState.imageUrl,
      secondary_image_url: formState.secondaryImageUrl,
      sort_order: formState.sortOrder,
      is_enabled: formState.isEnabled,
      metadata:
        formState.metadata as Database["public"]["Tables"]["public_site_sections"]["Row"]["metadata"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return resolvePublicSiteSections(Array.from(sectionMap.values()));
  }, [publishedSections, drafts, formState, activeDraft]);

  const activeNavItem = SECTION_NAVIGATION_ITEMS.find((s) => s.key === activeSectionKey);

  return (
    <div className="space-y-4">
      {/* ── Studio Header & Role Indicator ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--cs-text)]">Website Studio</h1>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  role === "owner"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                }`}
              >
                {role === "owner" ? "Owner Studio" : "Digital Marketer"}
              </span>
            </div>
            <p className="text-xs text-[var(--cs-text-secondary)]">
              Draft, edit, and preview homepage sections with real-time public component grounding.
            </p>
          </div>
        </div>

        {/* Mobile/Tablet Preview trigger */}
        <div className="flex items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => setIsMobilePreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface)]"
          >
            <Eye className="h-3.5 w-3.5" />
            Open Preview Window
          </button>
        </div>
      </div>

      {/* ── Feedback Notification ─────────────────────────────────── */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300"
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

      {/* ── Review Notes Alert (if changes requested) ─────────────── */}
      {activeDraft?.status === "changes_requested" && activeDraft.review_note && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <MessageSquare className="h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">Owner Review Notes for this Draft:</p>
              <p className="mt-1 leading-relaxed">{activeDraft.review_note}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Studio 3-Pane / 2-Column Layout ──────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[240px_1fr_480px] 2xl:grid-cols-[260px_1fr_560px]">
        {/* ── LEFT PANE: Section Navigation ──────────────────────── */}
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3.5 shadow-xs space-y-4">
          <div>
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--cs-text-secondary)]">
              Homepage Sections
            </h2>
          </div>

          {/* Managed Sections */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
              Managed Sections
            </p>
            {SECTION_NAVIGATION_ITEMS.filter((s) => s.category === "managed").map((item) => {
              const itemDraft = drafts.find(
                (d) => d.content_type === "section" && d.content_key === item.key
              );
              const isActive = activeSectionKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectSection(item.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${
                    isActive
                      ? "bg-purple-50 text-purple-900 font-semibold border border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800"
                      : "text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {itemDraft && (
                    <span className="ml-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                      {itemDraft.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Display Gates */}
          <div className="space-y-1 border-t border-[var(--cs-border)] pt-3">
            <p className="px-2 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              Display Gates
            </p>
            {SECTION_NAVIGATION_ITEMS.filter((s) => s.category === "gates").map((item) => {
              const isActive = activeSectionKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectSection(item.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800"
                      : "text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Static Preview Context */}
          <div className="space-y-1 border-t border-[var(--cs-border)] pt-3">
            <p className="px-2 text-[10px] font-semibold text-stone-500">
              Static Context (Read-Only)
            </p>
            {SECTION_NAVIGATION_ITEMS.filter((s) => s.category === "static").map((item) => {
              const isActive = activeSectionKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectSection(item.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${
                    isActive
                      ? "bg-stone-100 text-stone-900 font-semibold border border-stone-300 dark:bg-stone-800 dark:text-stone-200"
                      : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-[9px] text-stone-400">Static</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTER PANE: Section Editor & Action Bar ─────────────── */}
        <div className="space-y-4">
          <SectionEditor
            sectionKey={activeSectionKey}
            values={formState}
            onChange={(updated) => setFormState(updated)}
            mediaAssets={mediaAssets}
            disabled={isSaving || isSubmitting || isPublishing}
          />

          {/* Action Bar (Only for Managed & Gate sections) */}
          {activeNavItem?.category !== "static" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRevertDialogOpen(true)}
                  disabled={isSaving || isSubmitting || isPublishing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert to Live
                </button>

                {isDirty && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                    Unsaved Edits
                  </span>
                )}
              </div>

              {/* Digital Marketer Actions */}
              {role === "digital_marketer" && (
                <div className="flex items-center gap-2">
                  <form action={saveAction}>
                    <input type="hidden" name="id" value={activeDraft?.id ?? ""} />
                    <input type="hidden" name="contentType" value="section" />
                    <input type="hidden" name="contentKey" value={formState.sectionKey} />
                    <input type="hidden" name="title" value={formState.title} />
                    <input type="hidden" name="subtitle" value={formState.subtitle} />
                    <input type="hidden" name="body" value={formState.body} />
                    <input type="hidden" name="ctaLabel" value={formState.ctaLabel} />
                    <input type="hidden" name="ctaHref" value={formState.ctaHref} />
                    <input type="hidden" name="imageUrl" value={formState.imageUrl} />
                    <input
                      type="hidden"
                      name="secondaryImageUrl"
                      value={formState.secondaryImageUrl}
                    />
                    <input type="hidden" name="altText" value={formState.altText} />
                    <input type="hidden" name="linkHref" value={formState.linkHref} />
                    <input type="hidden" name="sortOrder" value={String(formState.sortOrder)} />
                    {formState.isEnabled && <input type="hidden" name="isEnabled" value="on" />}
                    <input
                      type="hidden"
                      name="metadataJson"
                      value={JSON.stringify(formState.metadata || {})}
                    />

                    <button
                      type="submit"
                      disabled={isSaving || isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface-warm)]"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save Draft"}
                    </button>
                  </form>

                  {activeDraft && activeDraft.status !== "submitted" && (
                    <form action={submitAction}>
                      <input type="hidden" name="id" value={activeDraft.id} />
                      <button
                        type="submit"
                        disabled={isSubmitting || isSaving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cs-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isSubmitting ? "Submitting..." : "Submit for Review"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Owner Actions */}
              {role === "owner" && (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={saveAction}>
                    <input type="hidden" name="id" value={activeDraft?.id ?? ""} />
                    <input type="hidden" name="contentType" value="section" />
                    <input type="hidden" name="contentKey" value={formState.sectionKey} />
                    <input type="hidden" name="title" value={formState.title} />
                    <input type="hidden" name="subtitle" value={formState.subtitle} />
                    <input type="hidden" name="body" value={formState.body} />
                    <input type="hidden" name="ctaLabel" value={formState.ctaLabel} />
                    <input type="hidden" name="ctaHref" value={formState.ctaHref} />
                    <input type="hidden" name="imageUrl" value={formState.imageUrl} />
                    <input
                      type="hidden"
                      name="secondaryImageUrl"
                      value={formState.secondaryImageUrl}
                    />
                    <input type="hidden" name="altText" value={formState.altText} />
                    <input type="hidden" name="linkHref" value={formState.linkHref} />
                    <input type="hidden" name="sortOrder" value={String(formState.sortOrder)} />
                    {formState.isEnabled && <input type="hidden" name="isEnabled" value="on" />}
                    <input
                      type="hidden"
                      name="metadataJson"
                      value={JSON.stringify(formState.metadata || {})}
                    />

                    <button
                      type="submit"
                      disabled={isSaving || isPublishing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface-warm)]"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save Draft
                    </button>
                  </form>

                  {activeDraft && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOwnerModal("request_changes")}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        Request Changes
                      </button>

                      {activeDraft.status !== "approved" && (
                        <form action={approveAction}>
                          <input type="hidden" name="id" value={activeDraft.id} />
                          <button
                            type="submit"
                            disabled={isApproving}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        onClick={() => setOwnerModal("schedule")}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Schedule
                      </button>

                      <form action={archiveAction}>
                        <input type="hidden" name="id" value={activeDraft.id} />
                        <button
                          type="submit"
                          disabled={isArchiving}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      </form>

                      <form action={publishAction}>
                        <input type="hidden" name="id" value={activeDraft.id} />
                        <button
                          type="submit"
                          disabled={isPublishing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          {isPublishing ? "Publishing..." : "Publish to Live"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANE: High-Fidelity Preview Rail (Desktop >= 1280px) */}
        <div className="hidden xl:block h-[calc(100vh-140px)] sticky top-4">
          <HighFidelityPreview
            draftSections={draftNormalizedSections}
            liveSections={liveNormalizedSections}
            activeSectionKey={activeSectionKey}
            branches={branches}
            services={services}
            canRevert={isDirty}
            onRevertToLive={() => setIsRevertDialogOpen(true)}
          />
        </div>
      </div>

      {/* ── Fullscreen Preview Modal (Mobile & Tablet) ─────────────── */}
      {isMobilePreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-xs p-4 xl:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between rounded-t-xl bg-[var(--cs-surface)] px-4 py-2.5 border-b border-[var(--cs-border)]">
            <span className="text-xs font-bold text-[var(--cs-text)]">
              Website Studio Live Preview
            </span>
            <button
              type="button"
              onClick={() => setIsMobilePreviewOpen(false)}
              className="rounded-lg p-1 text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden rounded-b-xl bg-[var(--cs-surface)]">
            <HighFidelityPreview
              draftSections={draftNormalizedSections}
              liveSections={liveNormalizedSections}
              activeSectionKey={activeSectionKey}
              branches={branches}
              services={services}
            />
          </div>
        </div>
      )}

      {/* ── Owner Request Changes Modal ────────────────────────────── */}
      {ownerModal === "request_changes" && activeDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-changes-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl">
            <h3
              id="request-changes-modal-title"
              className="text-base font-semibold text-[var(--cs-text)]"
            >
              Request Changes
            </h3>
            <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
              Provide specific feedback to the digital marketer on what to adjust.
            </p>
            <form action={requestAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={activeDraft.id} />
              <textarea
                name="reviewNote"
                rows={4}
                required
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
                placeholder="Describe required copy or image changes..."
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerModal(null)}
                  className="rounded-lg border border-[var(--cs-border)] px-4 py-2 text-xs font-semibold text-[var(--cs-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRequesting}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {isRequesting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Owner Schedule Modal ───────────────────────────────────── */}
      {ownerModal === "schedule" && activeDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl">
            <h3 id="schedule-modal-title" className="text-base font-semibold text-[var(--cs-text)]">
              Schedule Publication
            </h3>
            <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
              Select date and time to publish this section update.
            </p>
            <form action={scheduleAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={activeDraft.id} />
              <div>
                <label className="block text-xs font-semibold text-[var(--cs-text)]">
                  Publish Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 text-xs text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerModal(null)}
                  className="rounded-lg border border-[var(--cs-border)] px-4 py-2 text-xs font-semibold text-[var(--cs-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {isScheduling ? "Scheduling..." : "Confirm Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Unsaved Changes Confirmation Modal ────────────────────── */}
      <UnsavedChangesDialog
        isOpen={isUnsavedDialogOpen}
        onStay={() => {
          setIsUnsavedDialogOpen(false);
          setPendingSectionKey(null);
        }}
        onDiscard={handleDiscardAndNavigate}
        title="Unsaved Section Changes"
        message={`You have unsaved edits in ${activeNavItem?.label || "this section"}. If you switch sections now, your in-memory edits will be lost.`}
      />

      {/* ── Revert to Live Confirmation Modal ──────────────────────── */}
      <RevertToLiveDialog
        isOpen={isRevertDialogOpen}
        sectionName={activeNavItem?.label || "this section"}
        onCancel={() => setIsRevertDialogOpen(false)}
        onConfirm={handleRevertConfirm}
      />
    </div>
  );
}
