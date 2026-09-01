"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Archive,
  Check,
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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const assets = useMemo(() => {
    if (!uploadState.asset) return availableAssets;
    const uploaded = uploadState.asset;
    return [uploaded, ...availableAssets.filter((a) => a.id !== uploaded.id)];
  }, [availableAssets, uploadState.asset]);

  const selectedAsset = useMemo(() => {
    if (userSelectedAsset) return userSelectedAsset;
    if (uploadState.asset) return uploadState.asset;
    if (currentUrl) {
      const match =
        assets.find((a) => a.public_url === currentUrl || a.bucket_path === currentUrl) ?? null;
      if (match) return match;
    }
    return null;
  }, [userSelectedAsset, uploadState.asset, currentUrl, assets]);

  // Focus restoration & initial focus placement
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
    return undefined;
  }, [isOpen]);

  // Focus trap and escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
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

  const isSelectedArchived = selectedAsset?.status === "archived";
  const canConfirmSelection = Boolean(
    selectedAsset && !isSelectedArchived && selectedAsset.public_url
  );

  const handleConfirm = () => {
    if (selectedAsset && selectedAsset.status !== "archived" && selectedAsset.public_url) {
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
        ref={modalRef}
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
                width: 44,
                height: 44,
                borderRadius: 8,
                background: "var(--cs-primary-muted, rgba(99, 102, 241, 0.1))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cs-primary)",
                flexShrink: 0,
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
                Choose an active image or upload a new one.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
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
              transition: "border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease",
            }}
          >
            <X className="size-5" />
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
              padding: "0.75rem 0.5rem",
              minHeight: 44,
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
              transition: "color 0.15s ease, border-color 0.15s ease",
            }}
          >
            <FileImage className="size-4" />
            Browse Library ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            style={{
              padding: "0.75rem 0.5rem",
              minHeight: 44,
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
              transition: "color 0.15s ease, border-color 0.15s ease",
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
                    placeholder="Search by title, alt text, path..."
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
                    <option value="archived">Archived (Read-Only)</option>
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
                      style={{ fontSize: 12, padding: "0.5rem 1rem", minHeight: 44 }}
                    >
                      <Upload className="size-4" style={{ marginRight: 6 }} /> Upload Image
                    </button>
                  </div>
                ) : (
                  filteredAssets.map((asset) => {
                    const isArchived = asset.status === "archived";
                    const isSelected =
                      selectedAsset?.id === asset.id ||
                      selectedAsset?.public_url === asset.public_url;
                    const badge = statusBadgeColors(asset.status);

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          if (!isArchived) {
                            setUserSelectedAsset(asset);
                          }
                        }}
                        disabled={isArchived}
                        title={
                          isArchived ? "Archived asset cannot be selected" : (asset.title ?? "")
                        }
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          borderRadius: 8,
                          border: isSelected
                            ? "2px solid var(--cs-primary)"
                            : "1px solid var(--cs-border)",
                          background: isSelected ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                          overflow: "hidden",
                          cursor: isArchived ? "not-allowed" : "pointer",
                          opacity: isArchived ? 0.55 : 1,
                          textAlign: "left",
                          padding: 0,
                          position: "relative",
                          outline: "none",
                          minHeight: 44,
                          transition:
                            "border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
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

                          {isSelected && !isArchived && (
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

                          {isArchived && (
                            <div
                              style={{
                                position: "absolute",
                                top: 6,
                                right: 6,
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "#57534E",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Archive className="size-3" />
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

            {/* Sidebar Preview of Selection */}
            <div
              style={{
                width: 280,
                borderLeft: "1px solid var(--cs-border)",
                background: "var(--cs-surface-warm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--cs-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 0.75rem",
                }}
              >
                Selected Image
              </h3>

              {selectedAsset ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                  </div>

                  {isSelectedArchived && (
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: 6,
                        background: "#FEF2F2",
                        border: "1px solid #FCA5A5",
                        color: "#991B1B",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      <span>Archived asset cannot be selected for active use.</span>
                    </div>
                  )}

                  <div>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--cs-text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Title
                    </label>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 650,
                        color: "var(--cs-text)",
                        marginTop: 2,
                      }}
                    >
                      {selectedAsset.title || "Untitled Image"}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--cs-text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Alt Text
                    </label>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--cs-text)",
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {selectedAsset.alt_text}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--cs-text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Status
                    </label>
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={{
                          borderRadius: 4,
                          border: `1px solid ${statusBadgeColors(selectedAsset.status).border}`,
                          background: statusBadgeColors(selectedAsset.status).bg,
                          color: statusBadgeColors(selectedAsset.status).text,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          textTransform: "capitalize",
                        }}
                      >
                        {selectedAsset.status}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid var(--cs-border-soft)",
                      paddingTop: "0.5rem",
                      fontSize: 10,
                      color: "var(--cs-text-muted)",
                      wordBreak: "break-all",
                    }}
                  >
                    Path: {selectedAsset.bucket_path}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    color: "var(--cs-text-muted)",
                    fontSize: 12,
                  }}
                >
                  <p style={{ margin: 0 }}>Click an active image in the library to select it.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Direct Upload Tab */
          <div style={{ padding: "1.5rem 2rem", overflowY: "auto", maxHeight: 520 }}>
            {uploadState.error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: 6,
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  fontSize: 12,
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{uploadState.error}</span>
              </div>
            )}

            <form
              action={uploadAction}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
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
                  Image File <span style={{ color: "var(--cs-danger, #EF4444)" }}>*</span>
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.5rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    fontSize: 12,
                  }}
                />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cs-text-muted)" }}>
                  JPG, PNG, WebP, SVG, or GIF up to 10MB.
                </p>
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
                  Title / Name
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Hero Spa Banner"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.5rem 0.75rem",
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
                  Alt Text (Accessibility){" "}
                  <span style={{ color: "var(--cs-danger, #EF4444)" }}>*</span>
                </label>
                <input
                  type="text"
                  name="altText"
                  required
                  minLength={3}
                  placeholder="Descriptive explanation for screen readers (min 3 chars)"
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    color: "var(--cs-text)",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              {filterSectionKey && (
                <input type="hidden" name="sectionKey" value={filterSectionKey} />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="cs-btn cs-btn-secondary"
                  style={{ fontSize: 13, padding: "0.5rem 1rem", minHeight: 44 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadPending}
                  className="cs-btn cs-btn-primary"
                  style={{
                    fontSize: 13,
                    padding: "0.5rem 1.25rem",
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {uploadPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" /> Upload and Select
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--cs-border)",
            background: "var(--cs-surface-warm)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>
            {selectedAsset ? (
              isSelectedArchived ? (
                <span style={{ color: "#DC2626", fontWeight: 600 }}>
                  Cannot choose archived asset.
                </span>
              ) : (
                <span>
                  Selected: <strong>{selectedAsset.title || selectedAsset.bucket_path}</strong>
                </span>
              )
            ) : (
              "No active image selected"
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="cs-btn cs-btn-secondary"
              style={{ fontSize: 13, padding: "0.5rem 1rem", minHeight: 44 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirmSelection}
              className="cs-btn cs-btn-primary"
              style={{
                fontSize: 13,
                padding: "0.5rem 1.25rem",
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: canConfirmSelection ? "pointer" : "not-allowed",
                opacity: canConfirmSelection ? 1 : 0.5,
              }}
            >
              <Check className="size-4" /> Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
