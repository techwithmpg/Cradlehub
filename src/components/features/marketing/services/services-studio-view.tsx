"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle, Eye, ImageIcon, Plus, Save, Search, Send, X } from "lucide-react";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicCatalogService } from "@/lib/queries/services";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import { publishMarketingDraftAction } from "@/app/(dashboard)/owner/marketing/actions";
import { updateServicePresentationAction } from "@/app/(dashboard)/marketing/service-actions";
import { MarketingStudioPanel } from "@/components/features/marketing/shared/marketing-studio-panel";
import { MarketingFieldGroup } from "@/components/features/marketing/shared/marketing-field-group";
import { MarketingMediaField } from "@/components/features/marketing/shared/marketing-media-field";
import { MarketingActionBar } from "@/components/features/marketing/shared/marketing-action-bar";

export type ServicesStudioViewProps = {
  role: "digital_marketer" | "owner";
  services: PublicCatalogService[];
  drafts?: MarketingContentDraftRow[];
  revisions?: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
};

type ServiceFormValues = {
  imageUrl: string;
  imageAlt: string;
  description: string;
  shortDescription: string;
  badges: string[];
  inclusions: string[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ServicesStudioView({
  role,
  services = [],
  drafts = [],
  revisions: _revisions = [],
  mediaAssets = [],
}: ServicesStudioViewProps) {
  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const service of services) {
      if (service.categoryName) set.add(service.categoryName);
    }
    return ["All", ...Array.from(set)];
  }, [services]);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || "");

  const initialNoticeState: { success: boolean; message?: string; error?: string } = {
    success: true,
  };

  const [saveState, saveAction, isSaving] = useActionState(
    saveMarketingDraftAction,
    initialNoticeState
  );
  const [submitState, submitAction, isSubmitting] = useActionState(
    submitMarketingDraftAction,
    initialNoticeState
  );
  const [ownerUpdateState, ownerUpdateAction, isOwnerUpdating] = useActionState(
    updateServicePresentationAction,
    initialNoticeState
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishMarketingDraftAction,
    initialNoticeState
  );

  // Filtered service list
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = selectedCategory === "All" || s.categoryName === selectedCategory;
      const matchSearch =
        searchQuery.trim().length === 0 ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  const currentService = useMemo(() => {
    return (
      filteredServices.find((s) => s.id === selectedServiceId) ||
      filteredServices[0] ||
      services[0]
    );
  }, [filteredServices, selectedServiceId, services]);

  // Find active mutable draft for current service
  const activeServiceDraft = useMemo(() => {
    if (!currentService) return null;

    const draftFromAction =
      (saveState?.success && (saveState as { draft?: MarketingContentDraftRow }).draft) ||
      (submitState?.success && (submitState as { draft?: MarketingContentDraftRow }).draft);

    if (
      draftFromAction &&
      draftFromAction.content_type === "service" &&
      draftFromAction.content_key === currentService.id &&
      ["draft", "submitted", "changes_requested", "approved"].includes(draftFromAction.status)
    ) {
      return draftFromAction;
    }

    return (
      drafts.find(
        (d) =>
          d.content_type === "service" &&
          d.content_key === currentService.id &&
          ["draft", "submitted", "changes_requested", "approved"].includes(d.status)
      ) ?? null
    );
  }, [currentService, drafts, saveState, submitState]);

  // Initial values from active mutable draft or live catalog service
  const initialValues: ServiceFormValues = useMemo(() => {
    if (!currentService) {
      return {
        imageUrl: "",
        imageAlt: "",
        description: "",
        shortDescription: "",
        badges: [],
        inclusions: [],
      };
    }

    if (activeServiceDraft) {
      const meta =
        activeServiceDraft.metadata &&
        typeof activeServiceDraft.metadata === "object" &&
        !Array.isArray(activeServiceDraft.metadata)
          ? (activeServiceDraft.metadata as Record<string, unknown>)
          : {};

      const badges = Array.isArray(meta.badges) ? (meta.badges as string[]) : currentService.badges;
      const inclusions = Array.isArray(meta.inclusions)
        ? (meta.inclusions as string[])
        : currentService.inclusions;
      const shortDescription =
        typeof meta.shortDescription === "string"
          ? meta.shortDescription
          : currentService.shortDescription || "";

      return {
        imageUrl: activeServiceDraft.image_url || currentService.imageUrl || "",
        imageAlt:
          activeServiceDraft.alt_text ||
          currentService.imageAlt ||
          `${currentService.name} treatment`,
        description: activeServiceDraft.body || currentService.description || "",
        shortDescription,
        badges,
        inclusions,
      };
    }

    return {
      imageUrl: currentService.imageUrl || "",
      imageAlt: currentService.imageAlt || `${currentService.name} treatment`,
      description: currentService.description || "",
      shortDescription: currentService.shortDescription || "",
      badges: currentService.badges || [],
      inclusions: currentService.inclusions || [],
    };
  }, [currentService, activeServiceDraft]);

  const [formValues, setFormValues] = useState<ServiceFormValues>(initialValues);
  const [newBadgeText, setNewBadgeText] = useState("");
  const [newInclusionText, setNewInclusionText] = useState("");

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      const draft = drafts.find(
        (d) =>
          d.content_type === "service" &&
          d.content_key === service.id &&
          ["draft", "submitted", "changes_requested", "approved"].includes(d.status)
      );

      if (draft) {
        const meta =
          draft.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata)
            ? (draft.metadata as Record<string, unknown>)
            : {};
        setFormValues({
          imageUrl: draft.image_url || service.imageUrl || "",
          imageAlt: draft.alt_text || service.imageAlt || `${service.name} treatment`,
          description: draft.body || service.description || "",
          shortDescription:
            typeof meta.shortDescription === "string"
              ? meta.shortDescription
              : service.shortDescription || "",
          badges: Array.isArray(meta.badges) ? (meta.badges as string[]) : service.badges,
          inclusions: Array.isArray(meta.inclusions)
            ? (meta.inclusions as string[])
            : service.inclusions,
        });
      } else {
        setFormValues({
          imageUrl: service.imageUrl || "",
          imageAlt: service.imageAlt || `${service.name} treatment`,
          description: service.description || "",
          shortDescription: service.shortDescription || "",
          badges: service.badges || [],
          inclusions: service.inclusions || [],
        });
      }
    }
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(initialValues);
  }, [formValues, initialValues]);

  const handleAddBadge = () => {
    const trimmed = newBadgeText.trim();
    if (trimmed.length > 0 && !formValues.badges.includes(trimmed)) {
      setFormValues((prev) => ({ ...prev, badges: [...prev.badges, trimmed] }));
      setNewBadgeText("");
    }
  };

  const handleRemoveBadge = (index: number) => {
    setFormValues((prev) => ({
      ...prev,
      badges: prev.badges.filter((_, i) => i !== index),
    }));
  };

  const handleAddInclusion = () => {
    const trimmed = newInclusionText.trim();
    if (trimmed.length > 0 && !formValues.inclusions.includes(trimmed)) {
      setFormValues((prev) => ({ ...prev, inclusions: [...prev.inclusions, trimmed] }));
      setNewInclusionText("");
    }
  };

  const handleRemoveInclusion = (index: number) => {
    setFormValues((prev) => ({
      ...prev,
      inclusions: prev.inclusions.filter((_, i) => i !== index),
    }));
  };

  if (!currentService) {
    return (
      <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 text-center text-[var(--cs-text-secondary)]">
        <p className="text-sm font-medium text-[var(--cs-text)]">
          No services found matching filters
        </p>
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

      {/* Top Filter and Search Bar (Standardized Light Panel) */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === cat
                  ? "bg-[#C8A96B] font-bold text-[#10261D] shadow-xs"
                  : "bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] border border-[var(--cs-border)] hover:text-[var(--cs-text)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--cs-text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service name..."
            className="w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] py-2 pl-9 pr-3 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
          />
        </div>
      </div>

      {/* 3-Pane / 2-Column Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Service Selector List */}
        <div className="space-y-3 lg:col-span-4">
          <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#9A7B38] dark:text-[#C8A96B]">
              Catalog Services ({filteredServices.length})
            </h3>
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {filteredServices.map((service) => {
                const isSelected = service.id === currentService.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleSelectService(service.id)}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
                      isSelected
                        ? "border border-[#C8A96B]/50 bg-[#163A2B] text-[#F6EBD6] shadow-sm"
                        : "border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text)] hover:border-[#C8A96B]/30"
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--cs-surface)] border border-[var(--cs-border-subtle)] flex items-center justify-center">
                      {service.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-[var(--cs-text-tertiary)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-bold ${
                          isSelected ? "text-[#F6EBD6]" : "text-[var(--cs-text)]"
                        }`}
                      >
                        {service.name}
                      </p>
                      <p
                        className={`text-[11px] font-medium ${
                          isSelected ? "text-[#C8A96B]" : "text-[#8C6D23] dark:text-[#D4B57A]"
                        }`}
                      >
                        {service.categoryName} · {formatCurrency(service.price)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {service.isPublicBookable && (
                          <span className="rounded bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800 dark:text-emerald-300">
                            Bookable
                          </span>
                        )}
                        {service.isCsrOnly && (
                          <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                            CSR Only
                          </span>
                        )}
                        {service.isVip && (
                          <span className="rounded bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.2 text-[9px] font-semibold text-purple-800 dark:text-purple-300">
                            VIP
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center/Right Columns: Editor & Live Preview */}
        <div className="space-y-6 lg:col-span-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Editor Pane (Standardized Light Panel) */}
            <MarketingStudioPanel
              title={currentService.name}
              description={`${currentService.categoryName} · ${currentService.durationMinutes} min`}
              badge={
                <span className="inline-flex items-center rounded-full bg-[var(--cs-surface-warm)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cs-text-secondary)] border border-[var(--cs-border)]">
                  {activeServiceDraft ? `Draft: ${activeServiceDraft.status}` : "Live Synced"}
                </span>
              }
            >
              <div className="space-y-4">
                {/* 1. Service Image Slot */}
                <MarketingFieldGroup
                  title="1. Treatment Photography"
                  description="Standard 4:3 landscape photo for treatment cards"
                >
                  <MarketingMediaField
                    label="Service Photo (4:3)"
                    intent="SERVICE_PHOTO"
                    value={formValues.imageUrl}
                    altValue={formValues.imageAlt}
                    onChange={(url, alt) => {
                      setFormValues((p) => ({
                        ...p,
                        imageUrl: url,
                        imageAlt: alt || p.imageAlt,
                      }));
                    }}
                    availableAssets={mediaAssets}
                  />
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Image Alt Text
                    </label>
                    <input
                      type="text"
                      value={formValues.imageAlt}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, imageAlt: e.target.value }))
                      }
                      placeholder="Describe the massage treatment for screen readers"
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </MarketingFieldGroup>

                {/* 2. Descriptions */}
                <MarketingFieldGroup
                  title="2. Treatment Copy & Descriptions"
                  description="Short highlights and full public treatment description"
                >
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Short Description (Cards & Mobile)
                    </label>
                    <textarea
                      rows={2}
                      value={formValues.shortDescription}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, shortDescription: e.target.value }))
                      }
                      placeholder="Brief highlights of this therapy..."
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--cs-text)]">
                      Full Public Description
                    </label>
                    <textarea
                      rows={4}
                      aria-label="Full Public Description"
                      value={formValues.description}
                      onChange={(e) =>
                        setFormValues((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Detailed explanation of the therapy techniques and wellness benefits..."
                      className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </MarketingFieldGroup>

                {/* 3. Badges Manager */}
                <MarketingFieldGroup
                  title="3. Promotional Badges"
                  description="Highlight key tags on public catalog cards"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {formValues.badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#8C6D23] dark:text-[#D4B57A]"
                      >
                        {badge}
                        <button
                          type="button"
                          onClick={() => handleRemoveBadge(idx)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Remove badge ${badge}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newBadgeText}
                      onChange={(e) => setNewBadgeText(e.target.value)}
                      placeholder="e.g. Bestseller, Couples"
                      className="flex-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBadge}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#163A2B] px-3 py-1.5 text-xs font-semibold text-[#F6EBD6] hover:bg-[#1D4A35]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </MarketingFieldGroup>

                {/* 4. Inclusions Manager */}
                <MarketingFieldGroup
                  title="4. Service Inclusions"
                  description="Amenities included with this therapy"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {formValues.inclusions.map((inclusion, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--cs-text)]"
                      >
                        {inclusion}
                        <button
                          type="button"
                          onClick={() => handleRemoveInclusion(idx)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Remove inclusion ${inclusion}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newInclusionText}
                      onChange={(e) => setNewInclusionText(e.target.value)}
                      placeholder="e.g. Aromatherapy oils, Hot towel"
                      className="flex-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs text-[var(--cs-text)] shadow-xs focus:border-[#C8A96B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddInclusion}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#163A2B] px-3 py-1.5 text-xs font-semibold text-[#F6EBD6] hover:bg-[#1D4A35]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </MarketingFieldGroup>
              </div>

              {/* Action Buttons */}
              <div className="mt-5">
                <MarketingActionBar
                  role={role}
                  draftStatus={
                    activeServiceDraft?.status as
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
                      <form action={saveAction}>
                        <input type="hidden" name="id" value={activeServiceDraft?.id || ""} />
                        <input type="hidden" name="contentType" value="service" />
                        <input type="hidden" name="contentKey" value={currentService.id} />
                        <input type="hidden" name="title" value={currentService.name} />
                        <input type="hidden" name="body" value={formValues.description} />
                        <input type="hidden" name="imageUrl" value={formValues.imageUrl} />
                        <input type="hidden" name="altText" value={formValues.imageAlt} />
                        <input
                          type="hidden"
                          name="metadata"
                          value={JSON.stringify({
                            shortDescription: formValues.shortDescription,
                            badges: formValues.badges,
                            inclusions: formValues.inclusions,
                          })}
                        />
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface)] disabled:opacity-50"
                        >
                          <Save className="h-3.5 w-3.5 text-[#C8A96B]" />
                          {isSaving ? "Saving..." : "Save Draft"}
                        </button>
                      </form>

                      {/* Submit for Review (Marketer / Owner) */}
                      {activeServiceDraft &&
                        ["draft", "changes_requested"].includes(activeServiceDraft.status) && (
                          <form action={submitAction}>
                            <input type="hidden" name="id" value={activeServiceDraft.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3 py-1.5 text-xs font-semibold text-[#10261D] shadow-xs transition hover:bg-[#D4B57A] disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {isSubmitting ? "Submitting..." : "Submit for Review"}
                            </button>
                          </form>
                        )}

                      {role === "owner" && (
                        <>
                          {activeServiceDraft &&
                          ["submitted", "approved"].includes(activeServiceDraft.status) ? (
                            <form action={publishAction}>
                              <input type="hidden" name="id" value={activeServiceDraft.id} />
                              <button
                                type="submit"
                                disabled={isPublishing}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-3.5 py-1.5 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
                                {isPublishing ? "Publishing..." : "Publish to Live"}
                              </button>
                            </form>
                          ) : (
                            <form action={ownerUpdateAction}>
                              <input type="hidden" name="serviceId" value={currentService.id} />
                              <input type="hidden" name="imageUrl" value={formValues.imageUrl} />
                              <input type="hidden" name="imageAlt" value={formValues.imageAlt} />
                              <input
                                type="hidden"
                                name="description"
                                value={formValues.description}
                              />
                              <input
                                type="hidden"
                                name="shortDescription"
                                value={formValues.shortDescription}
                              />
                              <input
                                type="hidden"
                                name="badges"
                                value={JSON.stringify(formValues.badges)}
                              />
                              <input
                                type="hidden"
                                name="inclusions"
                                value={JSON.stringify(formValues.inclusions)}
                              />
                              <button
                                type="submit"
                                disabled={isOwnerUpdating}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-3.5 py-1.5 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
                                {isOwnerUpdating ? "Updating..." : "Update Live Service"}
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

            {/* Right Column: Live Card Preview (Dark Spa Visual Standard) */}
            <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/95 p-5 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#C8A96B]" />
                  <h3 className="text-sm font-medium text-[#F6EBD6]">Public Card Preview</h3>
                </div>
                <span className="text-[10px] text-[#9AA89A]">Matches /services & /</span>
              </div>

              {/* Simulated Service Card */}
              <div className="overflow-hidden rounded-xl border border-[#D4B57A]/20 bg-[#0D2B20]/90 p-4 shadow-xl backdrop-blur-xl">
                <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg bg-[#031B16]">
                  {formValues.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formValues.imageUrl}
                      alt={formValues.imageAlt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#9AA89A]">
                      <ImageIcon className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  {formValues.badges.length > 0 && (
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {formValues.badges.map((b, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-[#10261D]/90 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B] backdrop-blur-sm"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C8A96B]">
                        {currentService.categoryName}
                      </span>
                      <h4 className="text-sm font-semibold text-[#F6EBD6]">
                        {currentService.name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#C8A96B]">
                        {formatCurrency(currentService.price)}
                      </p>
                      <p className="text-[10px] text-[#9AA89A]">
                        {currentService.durationMinutes} min
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[#9AA89A] line-clamp-2">
                    {formValues.shortDescription ||
                      formValues.description ||
                      "A Cradle wellness treatment."}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                    <span className="text-[#9AA89A]">
                      {currentService.availableInSpa && currentService.availableHomeService
                        ? "In-Spa & Home Service"
                        : currentService.availableInSpa
                          ? "In-Spa Only"
                          : "Home Service Only"}
                    </span>
                    <span className="rounded-full border border-[#C8A96B]/40 px-2.5 py-0.5 text-[10px] font-medium text-[#C8A96B]">
                      Book Service
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Eligibility Invariant Box */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-[#9AA89A] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#C8A96B]">Mobile Public Filtering:</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      currentService.isPublicBookable &&
                      !currentService.isCsrOnly &&
                      !currentService.isVip
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {currentService.isPublicBookable &&
                    !currentService.isCsrOnly &&
                    !currentService.isVip
                      ? "Eligible for Mobile Home"
                      : "Filtered from Mobile Home"}
                  </span>
                </div>
                <p className="text-[11px]">
                  Invariant:{" "}
                  <code className="text-[#F6EBD6]">isPublicBookable && !isCsrOnly && !isVip</code>.
                  Booking semantics remain strictly operational.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
