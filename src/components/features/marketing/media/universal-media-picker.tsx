"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  CheckCircle2,
  FileImage,
  Filter,
  Image as ImageIcon,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import { uploadMediaFileAction } from "@/app/(dashboard)/marketing/media/actions";

export type SelectedMediaValue = {
  id?: string;
  publicUrl: string;
  altText: string;
  title?: string | null;
};

export type UniversalMediaPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: SelectedMediaValue) => void;
  currentUrl?: string | null;
  title?: string;
  availableAssets?: MarketingMediaAssetRow[];
  filterSectionKey?: string;
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

export function UniversalMediaPicker({
  isOpen,
  onClose,
  onSelect,
  currentUrl,
  title = "Select Media Asset",
  availableAssets = [],
  filterSectionKey,
}: UniversalMediaPickerProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userSelectedAsset, setUserSelectedAsset] = useState<MarketingMediaAssetRow | null>(null);

  const [uploadState, uploadAction, uploadPending] = useActionState(uploadMediaFileAction, {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assets = useMemo(() => {
    if (!uploadState.asset) return availableAssets;
    const uploaded = uploadState.asset;
    return [uploaded, ...availableAssets.filter((a) => a.id !== uploaded.id)];
  }, [availableAssets, uploadState.asset]);

  const selectedAsset = useMemo(() => {
    if (userSelectedAsset) return userSelectedAsset;
    if (uploadState.asset) return uploadState.asset;
    if (currentUrl) {
      return (
        assets.find((a) => a.public_url === currentUrl || a.bucket_path === currentUrl) ?? null
      );
    }
    return null;
  }, [userSelectedAsset, uploadState.asset, currentUrl, assets]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (statusFilter !== "all" && asset.status !== statusFilter) {
        return false;
      }
      if (filterSectionKey && asset.section_key && asset.section_key !== filterSectionKey) {
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
  }, [assets, statusFilter, filterSectionKey, search]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedAsset?.public_url) {
      onSelect({
        id: selectedAsset.id,
        publicUrl: selectedAsset.public_url,
        altText: selectedAsset.alt_text,
        title: selectedAsset.title,
      });
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
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
          maxWidth: 960,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--cs-border)",
            background: "var(--cs-surface-warm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "var(--cs-primary-muted, rgba(99, 102, 241, 0.1))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cs-primary)",
              }}
            >
              <ImageIcon className="size-5" />
            </div>
            <div>
              <h2
                id="media-picker-title"
                style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cs-text)" }}
              >
                {title}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>
                Choose an existing image or upload a new one.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="cs-btn-icon"
            style={{
              width: 36,
              height: 36,
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

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--cs-border)",
            padding: "0 1.25rem",
            gap: 16,
            background: "var(--cs-surface)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            style={{
              padding: "0.75rem 0.25rem",
              border: 0,
              borderBottom:
                activeTab === "library" ? "2px solid var(--cs-primary)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === "library" ? "var(--cs-primary)" : "var(--cs-text-muted)",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileImage className="size-4" />
            Browse Library ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            style={{
              padding: "0.75rem 0.25rem",
              border: 0,
              borderBottom:
                activeTab === "upload" ? "2px solid var(--cs-primary)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === "upload" ? "var(--cs-primary)" : "var(--cs-text-muted)",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload className="size-4" />
            Upload Asset
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "library" ? (
          <div
            style={{ display: "flex", flex: 1, minHeight: 420, maxHeight: 520, overflow: "hidden" }}
          >
            {/* Main Asset Grid Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Toolbar */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--cs-border-soft)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
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
                    placeholder="Search by title, alt text, path..."
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
                  </select>
                </div>
              </div>

              {/* Grid of Assets */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "1rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "0.75rem",
                  alignContent: "start",
                }}
              >
                {filteredAssets.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      padding: "3rem 1rem",
                      color: "var(--cs-text-muted)",
                      fontSize: 13,
                    }}
                  >
                    <ImageIcon className="size-8" style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No media assets found.</p>
                    <p style={{ margin: "4px 0 12px", fontSize: 12 }}>
                      {search
                        ? "Try adjusting your search filters."
                        : "Upload an asset to get started."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("upload")}
                      className="cs-btn cs-btn-secondary"
                      style={{ fontSize: 12, padding: "0.4rem 0.75rem" }}
                    >
                      <Upload className="size-3.5" style={{ marginRight: 6 }} /> Upload Image
                    </button>
                  </div>
                ) : (
                  filteredAssets.map((asset) => {
                    const isSelected =
                      selectedAsset?.id === asset.id ||
                      selectedAsset?.public_url === asset.public_url;
                    const badge = statusBadgeColors(asset.status);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setUserSelectedAsset(asset)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          borderRadius: 8,
                          border: isSelected
                            ? "2px solid var(--cs-primary)"
                            : "1px solid var(--cs-border)",
                          background: isSelected ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                          overflow: "hidden",
                          cursor: "pointer",
                          textAlign: "left",
                          padding: 0,
                          position: "relative",
                          outline: "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Thumbnail Container */}
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
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
                              sizes="140px"
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

                          {isSelected && (
                            <div
                              style={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "var(--cs-primary)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              }}
                            >
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          )}

                          <span
                            style={{
                              position: "absolute",
                              bottom: 4,
                              left: 4,
                              borderRadius: 4,
                              border: `1px solid ${badge.border}`,
                              background: badge.bg,
                              color: badge.text,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "1px 4px",
                              textTransform: "capitalize",
                            }}
                          >
                            {asset.status}
                          </span>
                        </div>

                        {/* Title / Alt */}
                        <div style={{ padding: "6px 8px" }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 650,
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
                              fontSize: 10,
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
                  })
                )}
              </div>
            </div>

            {/* Preview Sidebar */}
            {selectedAsset ? (
              <div
                style={{
                  width: 280,
                  borderLeft: "1px solid var(--cs-border)",
                  background: "var(--cs-surface-warm)",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--cs-text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Selected Asset
                </div>

                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 10",
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                  }}
                >
                  {selectedAsset.public_url ? (
                    <Image
                      src={selectedAsset.public_url}
                      alt={selectedAsset.alt_text}
                      fill
                      sizes="280px"
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
                      <ImageIcon className="size-8 opacity-30" />
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
                    {selectedAsset.title || "Untitled Image"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--cs-text-muted)",
                      marginTop: 2,
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedAsset.bucket_path}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--cs-border-soft)", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, color: "var(--cs-text-secondary)" }}>
                    Alt Text (Accessibility)
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--cs-text)",
                      marginTop: 4,
                      background: "var(--cs-surface)",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--cs-border-soft)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{selectedAsset.alt_text}</span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--cs-border-soft)",
                    paddingTop: 10,
                    fontSize: 11,
                    color: "var(--cs-text-muted)",
                  }}
                >
                  <div>
                    Status:{" "}
                    <strong style={{ color: "var(--cs-text)", textTransform: "capitalize" }}>
                      {selectedAsset.status}
                    </strong>
                  </div>
                  {selectedAsset.section_key && (
                    <div style={{ marginTop: 4 }}>
                      Section:{" "}
                      <strong style={{ color: "var(--cs-text)" }}>
                        {selectedAsset.section_key}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* Upload Tab */
          <div
            style={{
              padding: "2rem",
              minHeight: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <form
              action={uploadAction}
              style={{
                width: "100%",
                maxWidth: 480,
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
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
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--cs-surface-warm)",
                  transition: "border-color 0.15s ease",
                }}
              >
                <Upload
                  className="size-8"
                  style={{ margin: "0 auto 8px", color: "var(--cs-primary)" }}
                />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 650, color: "var(--cs-text)" }}>
                  Click to choose an image file
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
                  Title / Name (Optional)
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Couples Massage Treatment Room"
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
                  placeholder="e.g. Serene massage room with ambient lighting"
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

              <input type="hidden" name="sectionKey" value={filterSectionKey ?? ""} />

              <button
                type="submit"
                disabled={uploadPending}
                className="cs-btn cs-btn-primary"
                style={{
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 650,
                  marginTop: 8,
                }}
              >
                {uploadPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload & Select
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "0.875rem 1.25rem",
            borderTop: "1px solid var(--cs-border)",
            background: "var(--cs-surface-warm)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="cs-btn cs-btn-secondary"
            style={{ minHeight: 44, padding: "0 1rem", fontSize: 13, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedAsset?.public_url}
            onClick={handleConfirm}
            className="cs-btn cs-btn-primary"
            style={{
              minHeight: 44,
              padding: "0 1.25rem",
              fontSize: 13,
              fontWeight: 650,
              opacity: selectedAsset?.public_url ? 1 : 0.5,
              cursor: selectedAsset?.public_url ? "pointer" : "not-allowed",
            }}
          >
            Select Image
          </button>
        </div>
      </div>
    </div>
  );
}
