"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  ImageIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import type { Database, Json } from "@/types/supabase";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { SelectedMediaValue } from "@/components/features/marketing/media/universal-media-picker";
import { UniversalMediaPicker } from "@/components/features/marketing/media/universal-media-picker";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
} from "@/app/(dashboard)/marketing/actions";
import { updateBranchPresentationAction } from "@/app/(dashboard)/marketing/branch-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  if (branch.location_metadata && typeof branch.location_metadata === "object" && !Array.isArray(branch.location_metadata)) {
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
  revisions = [],
  mediaAssets = [],
}: BranchesStudioViewProps) {
  // Sort branches: Main Spa first, SM second
  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      const aIsMain = a.name.toLowerCase().includes("main") || a.name.toLowerCase().includes("lacson");
      const bIsMain = b.name.toLowerCase().includes("main") || b.name.toLowerCase().includes("lacson");
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [branches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    sortedBranches[0]?.id || ""
  );

  const currentBranch = useMemo(() => {
    return sortedBranches.find((b) => b.id === selectedBranchId) || sortedBranches[0];
  }, [sortedBranches, selectedBranchId]);

  // Find active draft for selected branch
  const activeBranchDraft = useMemo(() => {
    if (!currentBranch) return undefined;
    return drafts.find(
      (d) =>
        (d.content_type === "section" && d.content_key === `branch_${currentBranch.id.replace(/-/g, "_")}`) ||
        (d.content_type === "section" && d.content_key === "contact")
    );
  }, [drafts, currentBranch]);

  // Initial form values from branch and draft
  const initialValues: BranchFormValues = useMemo(() => {
    if (!currentBranch) {
      return {
        name: "",
        address: "",
        phone: "",
        email: "",
        fbPage: "",
        messengerLink: "",
        openingHours: "",
        mapsEmbedUrl: "",
        imageUrl: "",
      };
    }

    const meta = (currentBranch.location_metadata || {}) as Record<string, unknown>;
    const imgUrl = typeof meta.image_url === "string" ? meta.image_url : "";

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
  }, [currentBranch]);

  const [formValues, setFormValues] = useState<BranchFormValues>(initialValues);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Sync form values when selected branch changes
  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    const branch = sortedBranches.find((b) => b.id === branchId);
    if (branch) {
      const meta = (branch.location_metadata || {}) as Record<string, unknown>;
      const imgUrl = typeof meta.image_url === "string" ? meta.image_url : "";
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
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(formValues) !== JSON.stringify(initialValues);
  }, [formValues, initialValues]);

  const initialNoticeState: { success: boolean; message?: string; error?: string } = { success: true };

  const [saveState, saveAction, isSaving] = useActionState(saveMarketingDraftAction, initialNoticeState);
  const [submitState, submitAction, isSubmitting] = useActionState(submitMarketingDraftAction, initialNoticeState);
  const [ownerUpdateState, ownerUpdateAction, isOwnerUpdating] = useActionState(updateBranchPresentationAction, initialNoticeState);

  const handleFieldChange = (field: keyof BranchFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleMediaSelect = (value: SelectedMediaValue) => {
    setFormValues((prev) => ({
      ...prev,
      imageUrl: value.publicUrl || "",
    }));
    setShowMediaPicker(false);
  };

  if (!currentBranch) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0A1F18] p-8 text-center text-[#9AA89A]">
        <Building2 className="mx-auto h-8 w-8 text-[#C8A96B] mb-2" />
        <p className="text-sm font-medium text-[#F6EBD6]">No active branches found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action notices */}
      {ownerUpdateState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
          {ownerUpdateState.message}
        </div>
      )}
      {ownerUpdateState?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {ownerUpdateState.error}
        </div>
      )}
      {saveState?.message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
          {saveState.message}
        </div>
      )}

      {/* Branch Selection Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#C8A96B]" />
          <div>
            <h3 className="text-sm font-medium text-[#F6EBD6]">Select Branch to Manage</h3>
            <p className="text-xs text-[#9AA89A]">Manage public contact info, hours, and photos</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedBranches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            const isMain = branch.name.toLowerCase().includes("main") || branch.name.toLowerCase().includes("lacson");
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleSelectBranch(branch.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                  isSelected
                    ? "border border-[#C8A96B]/50 bg-[#163A2B] text-[#F6EBD6] shadow-md"
                    : "border border-white/5 bg-[#061410] text-[#9AA89A] hover:border-white/20 hover:text-[#F6EBD6]"
                }`}
              >
                <MapPin className={`h-3.5 w-3.5 ${isSelected ? "text-[#C8A96B]" : "text-[#9AA89A]"}`} />
                <span>{branch.name}</span>
                {isMain && (
                  <span className="rounded bg-[#C8A96B]/20 px-1.5 py-0.2 text-[10px] text-[#C8A96B]">
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
        {/* Left Column: Form Controls */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/90 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#D4B57A]/15 pb-4">
              <div>
                <h2 className="text-lg font-medium text-[#F6EBD6]">{currentBranch.name}</h2>
                <p className="text-xs text-[#9AA89A]">Public Presentation & Contact Channels</p>
              </div>
              {isDirty && (
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                  Unsaved Changes
                </span>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {/* Branch Name & Address */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                  Branch Identification & Location
                </label>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Public Branch Name</span>
                  <input
                    type="text"
                    value={formValues.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Full Street Address</span>
                  <textarea
                    rows={2}
                    value={formValues.address}
                    onChange={(e) => handleFieldChange("address", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Direct Contact Channels */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                  Guest Contact Channels
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Primary Phone</span>
                    <input
                      type="text"
                      value={formValues.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="0917-xxx-xxxx / (034) 433-xxxx"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Branch Email</span>
                    <input
                      type="email"
                      value={formValues.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="branch@cradlemassage.ph"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Facebook Page URL</span>
                    <input
                      type="text"
                      value={formValues.fbPage}
                      onChange={(e) => handleFieldChange("fbPage", e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9AA89A]">Messenger Link (m.me)</span>
                    <input
                      type="text"
                      value={formValues.messengerLink}
                      onChange={(e) => handleFieldChange("messengerLink", e.target.value)}
                      placeholder="https://m.me/..."
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-[#9AA89A]">Opening Hours Schedule</span>
                  <input
                    type="text"
                    value={formValues.openingHours}
                    onChange={(e) => handleFieldChange("openingHours", e.target.value)}
                    placeholder="10:00 AM - 10:00 PM Daily"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Photo & Map Embed */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
                    Branch Photo & Map Embed
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/30 bg-[#163A2B] px-2.5 py-1 text-xs text-[#F6EBD6] hover:bg-[#1D4A35]"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[#C8A96B]" />
                    Choose Photo
                  </button>
                </div>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Branch Photo URL</span>
                  <input
                    type="text"
                    value={formValues.imageUrl}
                    onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                    placeholder="/images/spa/cradle-main-spa.webp"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-[#9AA89A]">Google Maps Embed URL</span>
                  <input
                    type="text"
                    value={formValues.mapsEmbedUrl}
                    onChange={(e) => handleFieldChange("mapsEmbedUrl", e.target.value)}
                    placeholder="https://www.google.com/maps/embed?..."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#061410] px-3 py-2 text-xs text-[#F6EBD6] focus:border-[#C8A96B] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setFormValues(initialValues)}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#9AA89A] hover:bg-white/5 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revert
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {/* Save Draft Action (Marketer) */}
                <form action={saveAction}>
                  <input type="hidden" name="id" value={activeBranchDraft?.id || ""} />
                  <input type="hidden" name="contentType" value="section" />
                  <input type="hidden" name="contentKey" value={`branch_${currentBranch.id.replace(/-/g, "_")}`} />
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4B57A]/40 bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] hover:bg-[#1D4A35] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5 text-[#C8A96B]" />
                    {isSaving ? "Saving..." : "Save Draft"}
                  </button>
                </form>

                {/* Owner Direct Update */}
                {role === "owner" && (
                  <form action={ownerUpdateAction}>
                    <input type="hidden" name="branchId" value={currentBranch.id} />
                    <input type="hidden" name="name" value={formValues.name} />
                    <input type="hidden" name="address" value={formValues.address} />
                    <input type="hidden" name="phone" value={formValues.phone} />
                    <input type="hidden" name="email" value={formValues.email} />
                    <input type="hidden" name="fbPage" value={formValues.fbPage} />
                    <input type="hidden" name="messengerLink" value={formValues.messengerLink} />
                    <input type="hidden" name="openingHours" value={formValues.openingHours} />
                    <input type="hidden" name="mapsEmbedUrl" value={formValues.mapsEmbedUrl} />
                    <input type="hidden" name="imageUrl" value={formValues.imageUrl} />
                    <button
                      type="submit"
                      disabled={isOwnerUpdating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {isOwnerUpdating ? "Updating..." : "Update Live Branch"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Public Card Live Preview */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#D4B57A]/15 bg-[#0A1F18]/90 p-6 shadow-xl backdrop-blur-md">
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
                    {currentBranch.name.toLowerCase().includes("sm") ? "Mall Location" : "Flagship Sanctuary"}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#163A2B] text-[#C8A96B] shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <h4 className="text-xl font-medium text-[#F6EBD6]" style={{ fontFamily: "var(--sp-font-display)" }}>
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
                  Updates to this branch immediately update the public <code className="text-[#F6EBD6]">/branches</code> directory, <code className="text-[#F6EBD6]">/contact</code> cards, and <code className="text-[#F6EBD6]">SiteFooter</code> contact schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Media Picker Modal */}
      {showMediaPicker && (
        <UniversalMediaPicker
          isOpen={showMediaPicker}
          onClose={() => setShowMediaPicker(false)}
          onSelect={handleMediaSelect}
          currentUrl={formValues.imageUrl}
          title={`Choose Branch Photo for ${formValues.name}`}
          availableAssets={mediaAssets}
        />
      )}
    </div>
  );
}
