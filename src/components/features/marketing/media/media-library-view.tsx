"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Filter,
  Grid,
  Image as ImageIcon,
  List,
  Search,
  Send,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
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

type MediaLibraryViewProps = {
  initialAssets: MarketingMediaAssetRow[];
  initialUsageMap?: Record<string, MediaAssetUsageSummary>;
  userRole?: "owner" | "digital_marketer";
};

function statusBadgeColors(status: string) {
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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MediaLibraryView({
  initialAssets,
  initialUsageMap = {},
  userRole = "owner",
}: MediaLibraryViewProps) {
  const [assets, setAssets] = useState<MarketingMediaAssetRow[]>(initialAssets);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedAsset, setSelectedAsset] = useState<MarketingMediaAssetRow | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Inspector actions
  const [saveState, saveAction, savePending] = useActionState(saveMediaMetadataAction, {});
  const [submitState, submitAction, submitPending] = useActionState(submitMediaForReviewAction, {});
  const [approveState, approveAction, approvePending] = useActionState(approveMediaAssetAction, {});
  const [publishState, publishAction, publishPending] = useActionState(publishMediaAssetAction, {});
  const [archiveState, archiveAction, archivePending] = useActionState(archiveMediaAssetAction, {});

  // Upload action
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadMediaFileAction, {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state updates from actions
  const activeStateAsset =
    saveState.asset ??
    submitState.asset ??
    approveState.asset ??
    publishState.asset ??
    archiveState.asset ??
    uploadState.asset;

  if (activeStateAsset) {
    const existingIndex = assets.findIndex((a) => a.id === activeStateAsset.id);
    if (existingIndex >= 0) {
      if (assets[existingIndex] !== activeStateAsset) {
        const updated = [...assets];
        updated[existingIndex] = activeStateAsset;
        setAssets(updated);
        if (selectedAsset?.id === activeStateAsset.id) {
          setSelectedAsset(activeStateAsset);
        }
      }
    } else {
      setAssets([activeStateAsset, ...assets]);
      setSelectedAsset(activeStateAsset);
    }
  }

  const filteredAssets = useMemo(() => {
    const list = assets.filter((asset) => {
      if (statusFilter !== "all" && asset.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const inTitle = asset.title?.toLowerCase().includes(term);
        const inAlt = asset.alt_text?.toLowerCase().includes(term);
        const inPath = asset.bucket_path.toLowerCase().includes(term);
        if (!inTitle && !inAlt && !inPath) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return (a.title || "").localeCompare(b.title || "");
    });

    return list;
  }, [assets, statusFilter, search, sortBy]);

  const selectedUsage = selectedAsset ? initialUsageMap[selectedAsset.id] : undefined;

  const handleCopyUrl = (url?: string | null) => {
    if (url) {
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
                left: 10,
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
                padding: "0.5rem 0.75rem 0.5rem 2rem",
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
            <Filter className="size-3.5" style={{ color: "var(--cs-text-muted)" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.5rem 0.65rem",
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
              padding: "0.5rem 0.65rem",
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
              style={{
                padding: "0.4rem 0.6rem",
                border: 0,
                background: viewMode === "grid" ? "var(--cs-surface-warm)" : "transparent",
                color: viewMode === "grid" ? "var(--cs-primary)" : "var(--cs-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Grid view"
            >
              <Grid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                padding: "0.4rem 0.6rem",
                border: 0,
                borderLeft: "1px solid var(--cs-border)",
                background: viewMode === "list" ? "var(--cs-surface-warm)" : "transparent",
                color: viewMode === "list" ? "var(--cs-primary)" : "var(--cs-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="List view"
            >
              <List className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="cs-btn cs-btn-primary"
            style={{
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            <Upload className="size-4" />
            Upload Asset
          </button>
        </div>
      </div>

      {/* Main Grid + Inspector Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedAsset ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)",
          gap: "1rem",
          alignItems: "start",
        }}
        className="max-xl:!grid-cols-1"
      >
        {/* Asset Collection */}
        <div
          style={{
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            background: "var(--cs-surface)",
            padding: "1rem",
            minHeight: 480,
          }}
        >
          {filteredAssets.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "4rem 1rem",
                color: "var(--cs-text-muted)",
              }}
            >
              <ImageIcon className="size-10" style={{ margin: "0 auto 10px", opacity: 0.3 }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--cs-text)" }}>
                No media assets found
              </h3>
              <p style={{ fontSize: 13, margin: "6px 0 16px" }}>
                {search
                  ? "No assets match your search filters."
                  : "Upload public site images to start organizing."}
              </p>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="cs-btn cs-btn-secondary"
                style={{ fontSize: 13, minHeight: 44, padding: "0 1rem" }}
              >
                <Upload className="size-4" style={{ marginRight: 6 }} /> Upload First Image
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
              className="max-sm:!grid-cols-1 max-md:!grid-cols-2"
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
                    onClick={() => setSelectedAsset(asset)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 10,
                      border: isSelected
                        ? "2px solid var(--cs-primary)"
                        : "1px solid var(--cs-border)",
                      background: isSelected ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                      overflow: "hidden",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      outline: "none",
                      boxShadow: isSelected ? "0 0 0 1px var(--cs-primary)" : "none",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
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
                          sizes="200px"
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
                          <ImageIcon className="size-8 opacity-30" />
                        </div>
                      )}

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
                          padding: "2px 6px",
                          textTransform: "capitalize",
                        }}
                      >
                        {asset.status}
                      </span>

                      {liveCount > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            borderRadius: 12,
                            background: "rgba(0, 0, 0, 0.7)",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 650,
                            padding: "2px 6px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye className="size-3" /> {liveCount}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        padding: "0.625rem 0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
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
                    onClick={() => setSelectedAsset(asset)}
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
                onClick={() => setSelectedAsset(null)}
                className="cs-btn-icon"
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--cs-text-muted)",
                }}
              >
                <X className="size-4" />
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
                  style={{ objectFit: "contain" }}
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
                  title="Copy URL"
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    color: copied ? "var(--cs-primary)" : "var(--cs-text-muted)",
                    padding: 2,
                  }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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
                    padding: "0.5rem 0.65rem",
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
                    fontSize: 11,
                    fontWeight: 650,
                    color: "var(--cs-text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Alt Text (Accessibility) *
                </label>
                <input
                  type="text"
                  name="altText"
                  required
                  minLength={3}
                  defaultValue={selectedAsset.alt_text}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.65rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={savePending}
                className="cs-btn cs-btn-secondary"
                style={{ minHeight: 40, fontSize: 12, fontWeight: 650 }}
              >
                {savePending ? "Saving..." : "Save Details"}
              </button>
            </form>

            {/* Workflow Status Actions */}
            <div style={{ borderTop: "1px solid var(--cs-border-soft)", paddingTop: "0.75rem" }}>
              <div
                style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)", marginBottom: 8 }}
              >
                Workflow Status:{" "}
                <span style={{ textTransform: "capitalize" }}>{selectedAsset.status}</span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedAsset.status === "draft" && (
                  <form action={submitAction}>
                    <input type="hidden" name="id" value={selectedAsset.id} />
                    <button
                      type="submit"
                      disabled={submitPending}
                      className="cs-btn cs-btn-primary"
                      style={{ fontSize: 12, padding: "0.4rem 0.75rem", minHeight: 38 }}
                    >
                      <Send className="size-3.5" style={{ marginRight: 4 }} /> Submit for Review
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
                      style={{ fontSize: 12, padding: "0.4rem 0.75rem", minHeight: 38 }}
                    >
                      <Check className="size-3.5" style={{ marginRight: 4 }} /> Approve Asset
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
                      style={{ fontSize: 12, padding: "0.4rem 0.75rem", minHeight: 38 }}
                    >
                      <CheckCircle2 className="size-3.5" style={{ marginRight: 4 }} /> Publish Asset
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
                        Cannot archive: referenced by {selectedUsage.totalLiveUsages} live
                        consumer(s).
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
                            padding: "0.4rem 0.75rem",
                            minHeight: 38,
                            width: "100%",
                            color: "var(--cs-text-muted)",
                          }}
                        >
                          <Archive className="size-3.5" style={{ marginRight: 4 }} /> Safely Archive
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
              {selectedUsage && selectedUsage.usages.length > 0 ? (
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
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div>
                Path: <span style={{ color: "var(--cs-text)" }}>{selectedAsset.bucket_path}</span>
              </div>
              <div>
                Size:{" "}
                <span style={{ color: "var(--cs-text)" }}>
                  {formatBytes((selectedAsset.metadata as Record<string, number>)?.sizeBytes)}
                </span>
              </div>
              <div>
                Added:{" "}
                <span style={{ color: "var(--cs-text)" }}>
                  {new Date(selectedAsset.created_at).toLocaleDateString()}
                </span>
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
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cs-text)" }}>
                Upload Media Asset
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="cs-btn-icon"
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--cs-text-muted)",
                }}
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              action={async (formData) => {
                await uploadAction(formData);
                setIsUploadOpen(false);
              }}
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
                  }}
                >
                  {uploadState.error}
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
