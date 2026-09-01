"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  FileImage,
  Filter,
  Grid3X3,
  Image as ImageIcon,
  LayoutList,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import type { MarketingMediaStatus } from "@/lib/validations/marketing";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { MediaAssetUsageSummary } from "@/lib/marketing/media-usage-analyzer";
import {
  saveMediaMetadataAction,
  submitMediaForReviewAction,
  approveMediaAssetAction,
  publishMediaAssetAction,
  archiveMediaAssetAction,
  uploadMediaFileAction,
} from "@/app/(dashboard)/marketing/media/actions";

export type MediaLibraryViewProps = {
  initialAssets: MarketingMediaAssetRow[];
  initialUsageMap: Record<string, MediaAssetUsageSummary>;
  userRole: "owner" | "digital_marketer";
};

function statusBadgeColors(status: MarketingMediaStatus) {
  switch (status) {
    case "published":
      return { bg: "#DCFCE7", text: "#14532D", border: "#86EFAC" };
    case "approved":
      return { bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" };
    case "submitted":
      return { bg: "#E0F2FE", text: "#075985", border: "#BAE6FD" };
    case "archived":
      return { bg: "#F5F5F4", text: "#57534E", border: "#E7E5E4" };
    default:
      return {
        bg: "var(--cs-surface-warm)",
        text: "var(--cs-text-secondary)",
        border: "var(--cs-border-soft)",
      };
  }
}

export function MediaLibraryView({
  initialAssets,
  initialUsageMap,
  userRole,
}: MediaLibraryViewProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [copied, setCopied] = useState(false);

  const uploadModalRef = useRef<HTMLDivElement>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server actions
  const [saveState, saveAction, savePending] = useActionState(saveMediaMetadataAction, {});
  const [submitState, submitAction, submitPending] = useActionState(submitMediaForReviewAction, {});
  const [approveState, approveAction, approvePending] = useActionState(approveMediaAssetAction, {});
  const [publishState, publishAction, publishPending] = useActionState(publishMediaAssetAction, {});
  const [archiveState, archiveAction, archivePending] = useActionState(archiveMediaAssetAction, {});
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadMediaFileAction, {});

  const latestActionAsset =
    uploadState.asset ||
    saveState.asset ||
    submitState.asset ||
    approveState.asset ||
    publishState.asset ||
    archiveState.asset;

  const assets = useMemo(() => {
    if (!latestActionAsset) return initialAssets;
    const exists = initialAssets.some((a) => a.id === latestActionAsset.id);
    if (exists) {
      return initialAssets.map((a) => (a.id === latestActionAsset.id ? latestActionAsset : a));
    }
    return [latestActionAsset, ...initialAssets];
  }, [initialAssets, latestActionAsset]);

  const selectedAsset = useMemo(() => {
    if (selectedAssetId) {
      return assets.find((a) => a.id === selectedAssetId) ?? null;
    }
    if (latestActionAsset) {
      return latestActionAsset;
    }
    return null;
  }, [selectedAssetId, latestActionAsset, assets]);

  // Focus trap & accessibility for upload modal
  useEffect(() => {
    if (isUploadOpen) {
      const timer = setTimeout(() => {
        const firstFocusable = uploadModalRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (uploadTriggerRef.current) {
      uploadTriggerRef.current.focus();
    }
    return undefined;
  }, [isUploadOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isUploadOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsUploadOpen(false);
        return;
      }

      if (e.key === "Tab") {
        const focusable = uploadModalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (first && last) {
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isUploadOpen]);

  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        if (statusFilter !== "all" && asset.status !== statusFilter) {
          return false;
        }
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const inTitle = asset.title?.toLowerCase().includes(term);
          const inAlt = asset.alt_text?.toLowerCase().includes(term);
          const inPath = asset.bucket_path.toLowerCase().includes(term);
          const inSection = asset.section_key?.toLowerCase().includes(term);
          if (!inTitle && !inAlt && !inPath && !inSection) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title") {
          return (a.title || a.bucket_path).localeCompare(b.title || b.bucket_path);
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [assets, statusFilter, search, sortBy]);

  const selectedUsage = selectedAsset ? initialUsageMap[selectedAsset.id] : null;

  const handleCopyUrl = (url: string | null) => {
    if (url && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              className="size-4"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--cs-text-muted)",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by title, alt text, path..."
              style={{
                width: "100%",
                minHeight: 44,
                padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                background: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter className="size-4" style={{ color: "var(--cs-text-muted)" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                minHeight: 44,
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                background: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="approved">Approved</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "title")}
            style={{
              minHeight: 44,
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              color: "var(--cs-text)",
              fontSize: 12,
              fontWeight: 600,
              outline: "none",
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">Title A-Z</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--cs-border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className="cs-btn-icon"
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: 0,
                background: viewMode === "grid" ? "var(--cs-surface-warm)" : "transparent",
                color: viewMode === "grid" ? "var(--cs-primary)" : "var(--cs-text-muted)",
                cursor: "pointer",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
            >
              <Grid3X3 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className="cs-btn-icon"
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: 0,
                borderLeft: "1px solid var(--cs-border)",
                background: viewMode === "list" ? "var(--cs-surface-warm)" : "transparent",
                color: viewMode === "list" ? "var(--cs-primary)" : "var(--cs-text-muted)",
                cursor: "pointer",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
            >
              <LayoutList className="size-4" />
            </button>
          </div>

          <button
            ref={uploadTriggerRef}
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="cs-btn cs-btn-primary"
            style={{
              minHeight: 44,
              padding: "0 1.25rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            <Plus className="size-4" /> Upload Asset
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedAsset ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Assets Browser */}
        <div
          style={{
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            background: "var(--cs-surface)",
            padding: "1rem",
            minHeight: 480,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--cs-border-soft)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
              Media Library Assets ({filteredAssets.length})
            </div>
            {statusFilter !== "all" && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--cs-surface-warm)",
                  color: "var(--cs-text-muted)",
                }}
              >
                Filtered: {statusFilter}
              </span>
            )}
          </div>

          {filteredAssets.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "4rem 1rem",
                color: "var(--cs-text-muted)",
              }}
            >
              <FileImage className="size-12 opacity-30" style={{ margin: "0 auto 12px" }} />
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: "0 0 4px",
                  color: "var(--cs-text)",
                }}
              >
                No media assets found
              </h3>
              <p style={{ fontSize: 12, margin: "0 0 1rem" }}>
                {search
                  ? "No assets match your search criteria."
                  : "Upload media assets to get started."}
              </p>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="cs-btn cs-btn-secondary"
                style={{ minHeight: 44, padding: "0 1rem" }}
              >
                <Plus className="size-4" style={{ marginRight: 6 }} /> Upload First Image
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                const badge = statusBadgeColors(asset.status);
                const usage = initialUsageMap[asset.id];
                const liveCount = usage?.totalLiveUsages ?? 0;

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 8,
                      border: isSelected
                        ? "2px solid var(--cs-primary)"
                        : "1px solid var(--cs-border-soft)",
                      background: isSelected ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                      overflow: "hidden",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      position: "relative",
                      outline: "none",
                      minHeight: 44,
                      transition:
                        "border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        position: "relative",
                        background: "var(--cs-surface-warm)",
                        overflow: "hidden",
                      }}
                    >
                      {asset.public_url ? (
                        <Image
                          src={asset.public_url}
                          alt={asset.alt_text}
                          fill
                          sizes="180px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--cs-text-muted)",
                          }}
                        >
                          <ImageIcon className="size-6 opacity-40" />
                        </div>
                      )}

                      {/* Status Badge */}
                      <span
                        style={{
                          position: "absolute",
                          bottom: 6,
                          left: 6,
                          borderRadius: 4,
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.text,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 5px",
                          textTransform: "capitalize",
                        }}
                      >
                        {asset.status}
                      </span>

                      {/* Live Usage Indicator */}
                      {liveCount > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            borderRadius: 999,
                            background: "var(--cs-primary)",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 750,
                            padding: "1px 6px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        >
                          {liveCount} live
                        </span>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div style={{ padding: "8px 10px" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--cs-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {asset.title || asset.bucket_path.split("/").pop()}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--cs-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 2,
                        }}
                      >
                        {asset.alt_text}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                const badge = statusBadgeColors(asset.status);
                const usage = initialUsageMap[asset.id];
                const liveCount = usage?.totalLiveUsages ?? 0;

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0.5rem 0.75rem",
                      borderRadius: 8,
                      border: isSelected
                        ? "2px solid var(--cs-primary)"
                        : "1px solid var(--cs-border-soft)",
                      background: isSelected ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                      cursor: "pointer",
                      minHeight: 44,
                      transition: "border-color 0.15s ease, background-color 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        position: "relative",
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "var(--cs-surface-warm)",
                        flexShrink: 0,
                      }}
                    >
                      {asset.public_url ? (
                        <Image
                          src={asset.public_url}
                          alt={asset.alt_text}
                          fill
                          sizes="48px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <ImageIcon className="size-5 opacity-30 m-auto" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--cs-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {asset.title || asset.bucket_path.split("/").pop()}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--cs-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {asset.alt_text}
                      </div>
                    </div>

                    <span
                      style={{
                        borderRadius: 4,
                        border: `1px solid ${badge.border}`,
                        background: badge.bg,
                        color: badge.text,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        textTransform: "capitalize",
                      }}
                    >
                      {asset.status}
                    </span>

                    {liveCount > 0 ? (
                      <span style={{ fontSize: 11, color: "var(--cs-primary)", fontWeight: 650 }}>
                        {liveCount} live use{liveCount === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>0 uses</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspector Drawer / Sidebar */}
        {selectedAsset && (
          <aside
            style={{
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              background: "var(--cs-surface)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 750, color: "var(--cs-text)" }}>
                Asset Inspector
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssetId(null)}
                aria-label="Close asset inspector"
                className="cs-btn-icon"
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--cs-text-muted)",
                  transition: "border-color 0.15s ease, color 0.15s ease",
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Large Preview */}
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 10",
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--cs-border)",
                background: "var(--cs-surface-warm)",
              }}
            >
              {selectedAsset.public_url ? (
                <Image
                  src={selectedAsset.public_url}
                  alt={selectedAsset.alt_text}
                  fill
                  sizes="380px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ImageIcon className="size-10 opacity-30" />
                </div>
              )}
            </div>

            {/* Public URL & Copy */}
            {selectedAsset.public_url && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0.5rem 0.75rem",
                  background: "var(--cs-surface-warm)",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={selectedAsset.public_url}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: 0,
                    fontSize: 11,
                    color: "var(--cs-text)",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleCopyUrl(selectedAsset.public_url)}
                  aria-label="Copy public URL"
                  title="Copy URL"
                  style={{
                    width: 44,
                    height: 44,
                    minWidth: 44,
                    minHeight: 44,
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: copied ? "var(--cs-primary)" : "var(--cs-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
            )}

            {/* Metadata Edit Form */}
            <form
              action={saveAction}
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              <input type="hidden" name="id" value={selectedAsset.id} />
              <input type="hidden" name="bucketPath" value={selectedAsset.bucket_path} />
              <input type="hidden" name="publicUrl" value={selectedAsset.public_url ?? ""} />
              <input
                type="hidden"
                name="metadataJson"
                value={JSON.stringify(selectedAsset.metadata ?? {})}
              />

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 650,
                    color: "var(--cs-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Title / Name
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={selectedAsset.title ?? ""}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 650,
                    color: "var(--cs-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Alt Text (Accessibility) *
                </label>
                <textarea
                  name="altText"
                  rows={2}
                  required
                  defaultValue={selectedAsset.alt_text}
                  style={{
                    width: "100%",
                    minHeight: 64,
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 12,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 650,
                    color: "var(--cs-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Section Key / Group
                </label>
                <input
                  type="text"
                  name="sectionKey"
                  defaultValue={selectedAsset.section_key ?? ""}
                  placeholder="e.g. hero, gallery, about"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              {saveState.error && (
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: 6,
                    background: "#FEE2E2",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    fontSize: 11,
                  }}
                >
                  {saveState.error}
                </div>
              )}

              {saveState.success && (
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: 6,
                    background: "#DCFCE7",
                    border: "1px solid #86EFAC",
                    color: "#166534",
                    fontSize: 11,
                  }}
                >
                  Details updated successfully.
                </div>
              )}

              <button
                type="submit"
                disabled={savePending}
                className="cs-btn cs-btn-secondary"
                style={{ fontSize: 12, minHeight: 44, padding: "0 0.75rem" }}
              >
                {savePending ? "Saving..." : "Save Details"}
              </button>
            </form>

            {/* Workflow & Status Actions */}
            <div style={{ borderTop: "1px solid var(--cs-border-soft)", paddingTop: "0.75rem" }}>
              <div
                style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)", marginBottom: 6 }}
              >
                Workflow Lifecycle
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>Current Status:</span>
                <span
                  style={{
                    borderRadius: 4,
                    border: `1px solid ${statusBadgeColors(selectedAsset.status).border}`,
                    background: statusBadgeColors(selectedAsset.status).bg,
                    color: statusBadgeColors(selectedAsset.status).text,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 6px",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedAsset.status}
                </span>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedAsset.status === "draft" && (
                  <form action={submitAction}>
                    <input type="hidden" name="id" value={selectedAsset.id} />
                    <button
                      type="submit"
                      disabled={submitPending}
                      className="cs-btn cs-btn-primary"
                      style={{ fontSize: 12, padding: "0 0.75rem", minHeight: 44, width: "100%" }}
                    >
                      <Send className="size-4" style={{ marginRight: 6 }} /> Submit for Review
                    </button>
                  </form>
                )}

                {userRole === "owner" && selectedAsset.status === "submitted" && (
                  <form action={approveAction}>
                    <input type="hidden" name="id" value={selectedAsset.id} />
                    <button
                      type="submit"
                      disabled={approvePending}
                      className="cs-btn cs-btn-primary"
                      style={{ fontSize: 12, padding: "0 0.75rem", minHeight: 44, width: "100%" }}
                    >
                      <Check className="size-4" style={{ marginRight: 6 }} /> Approve Asset
                    </button>
                  </form>
                )}

                {userRole === "owner" && selectedAsset.status === "approved" && (
                  <form action={publishAction}>
                    <input type="hidden" name="id" value={selectedAsset.id} />
                    <button
                      type="submit"
                      disabled={publishPending}
                      className="cs-btn cs-btn-primary"
                      style={{ fontSize: 12, padding: "0 0.75rem", minHeight: 44, width: "100%" }}
                    >
                      <CheckCircle2 className="size-4" style={{ marginRight: 6 }} /> Publish Asset
                    </button>
                  </form>
                )}

                {/* Archive Workflow */}
                {userRole === "owner" && selectedAsset.status !== "archived" && (
                  <div style={{ width: "100%", marginTop: 8 }}>
                    {selectedUsage && !selectedUsage.canSafelyArchive ? (
                      <div
                        style={{
                          padding: "0.625rem",
                          borderRadius: 6,
                          background: "#FEF3C7",
                          border: "1px solid #FDE68A",
                          color: "#92400E",
                          fontSize: 11,
                          lineHeight: 1.4,
                        }}
                      >
                        <ShieldAlert
                          className="size-4"
                          style={{
                            display: "inline",
                            verticalAlign: "text-bottom",
                            marginRight: 4,
                          }}
                        />
                        {selectedUsage.usageUnknown
                          ? "Usage incomplete / archive cannot be finalized"
                          : `Cannot archive: referenced by ${selectedUsage.totalLiveUsages} live consumer(s).`}
                      </div>
                    ) : (
                      <form action={archiveAction}>
                        <input type="hidden" name="id" value={selectedAsset.id} />
                        <button
                          type="submit"
                          disabled={archivePending}
                          className="cs-btn cs-btn-secondary"
                          style={{
                            fontSize: 12,
                            padding: "0 0.75rem",
                            minHeight: 44,
                            width: "100%",
                            color: "var(--cs-text-muted)",
                          }}
                        >
                          <Archive className="size-4" style={{ marginRight: 6 }} /> Safely Archive
                          Asset
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Usage Analysis */}
            <div style={{ borderTop: "1px solid var(--cs-border-soft)", paddingTop: "0.75rem" }}>
              <div
                style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)", marginBottom: 6 }}
              >
                Usage References
              </div>

              {selectedUsage?.usageUnknown ? (
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: 6,
                    background: "#FEF3C7",
                    border: "1px solid #FDE68A",
                    color: "#92400E",
                    fontSize: 11,
                  }}
                >
                  Usage incomplete / archive cannot be finalized
                </div>
              ) : selectedUsage && selectedUsage.usages.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUsage.usages.map((u, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        background: "var(--cs-surface-warm)",
                        border: "1px solid var(--cs-border-soft)",
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: 650,
                        }}
                      >
                        <span>{u.label}</span>
                        <span style={{ color: u.isLive ? "#166534" : "var(--cs-text-muted)" }}>
                          {u.isLive ? "Live" : "Draft"}
                        </span>
                      </div>
                      {u.context && (
                        <div style={{ color: "var(--cs-text-muted)", fontSize: 10, marginTop: 2 }}>
                          {u.context}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
                  No known active references.
                </div>
              )}
            </div>

            {/* File Info */}
            <div
              style={{
                borderTop: "1px solid var(--cs-border-soft)",
                paddingTop: "0.75rem",
                fontSize: 11,
                color: "var(--cs-text-muted)",
              }}
            >
              <div style={{ marginBottom: 2 }}>
                <strong>Bucket Path:</strong> {selectedAsset.bucket_path}
              </div>
              <div>
                <strong>Uploaded:</strong> {new Date(selectedAsset.created_at).toLocaleDateString()}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Upload Dialog Modal */}
      {isUploadOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            padding: "1rem",
          }}
        >
          <div
            ref={uploadModalRef}
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 12,
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3
                id="upload-dialog-title"
                style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cs-text)" }}
              >
                Upload Media Asset
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                aria-label="Close upload dialog"
                className="cs-btn-icon"
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--cs-text-muted)",
                  transition: "border-color 0.15s ease, color 0.15s ease",
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              action={uploadAction}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {uploadState.error && (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: 8,
                    background: "#FEE2E2",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{uploadState.error}</span>
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--cs-border)",
                  borderRadius: 10,
                  padding: "2rem 1rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--cs-surface-warm)",
                  minHeight: 44,
                }}
              >
                <Upload
                  className="size-8"
                  style={{ margin: "0 auto 8px", color: "var(--cs-primary)" }}
                />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 650, color: "var(--cs-text)" }}>
                  Click to select an image file
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>
                  JPG, PNG, WebP, SVG, GIF up to 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                  required
                  style={{ display: "none" }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 650,
                    color: "var(--cs-text)",
                    marginBottom: 4,
                  }}
                >
                  Title / Friendly Name
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Signature Facial Treatment"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.625rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 650,
                    color: "var(--cs-text)",
                    marginBottom: 4,
                  }}
                >
                  Alt Text (Required, at least 3 characters) *
                </label>
                <input
                  type="text"
                  name="altText"
                  required
                  minLength={3}
                  placeholder="e.g. Guest enjoying a calming facial massage"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.625rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="cs-btn cs-btn-secondary"
                  style={{ minHeight: 44, padding: "0 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadPending}
                  className="cs-btn cs-btn-primary"
                  style={{ minHeight: 44, padding: "0 1.25rem" }}
                >
                  {uploadPending ? "Uploading..." : "Upload Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
