"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, Globe, Monitor, Pencil, Smartphone, Tablet } from "lucide-react";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { HomePageSectionsRenderer } from "@/components/public/home-page-sections";
import {
  PublicMobileHomeRenderer,
  isPublicSafeService,
} from "@/components/public/mobile/public-mobile-home";

export type PreviewMode = "draft" | "live" | "compare";
export type PreviewViewport = "desktop" | "tablet" | "mobile";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export const VIEWPORT_TARGET_WIDTHS: Record<PreviewViewport, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

/**
 * Calculates a non-upscaled visual scale factor (<= 1) based on available container width
 * and target viewport width.
 */
export function calculateViewportScale(availableWidth: number, targetWidth: number): number {
  if (availableWidth <= 0 || targetWidth <= 0) return 1;
  if (availableWidth >= targetWidth) return 1;
  return Math.min(1, Math.max(0.1, availableWidth / targetWidth));
}

export type IsolatedViewportFrameProps = {
  viewport: PreviewViewport;
  title: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * IsolatedViewportFrame encapsulates the preview inside an iframe container
 * with a STRICTLY FIXED internal layout width (1280px Desktop, 768px Tablet, 375px Mobile)
 * so CSS/Tailwind media queries (@media min-width, md:, lg:) evaluate genuinely against
 * the selected target width. If the host pane is narrower, visual scaling (CSS transform)
 * is applied without reducing the iframe's internal CSS layout width.
 */
export function IsolatedViewportFrame({
  viewport,
  title,
  className = "",
  children,
}: IsolatedViewportFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState<number>(1);

  const targetWidth = VIEWPORT_TARGET_WIDTHS[viewport];
  const iframeHeight = 840;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const updateScale = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth > 0) {
        setScale(calculateViewportScale(containerWidth, targetWidth));
      }
    };

    updateScale();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateScale);
      observer.observe(container);
      return () => {
        observer.disconnect();
      };
    }
    return undefined;
  }, [targetWidth]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const head = doc.head;
    if (head) {
      head.innerHTML = "";
      // Replicate document stylesheets and style elements to ensure Tailwind classes apply
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        head.appendChild(node.cloneNode(true));
      });
      const resetStyle = doc.createElement("style");
      resetStyle.textContent = `
        *, ::before, ::after { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          min-height: 100%;
          font-family: inherit;
          background: #ffffff;
          color: #1c1917;
        }
      `;
      head.appendChild(resetStyle);
    }
    setMountNode(doc.body);
  }, [viewport]);

  const scaledWidth = targetWidth * scale;
  const scaledHeight = iframeHeight * scale;

  return (
    <div
      ref={containerRef}
      data-testid={`isolated-viewport-${viewport}`}
      data-viewport={viewport}
      data-scale={scale}
      className={`flex justify-center w-full overflow-hidden ${className}`}
    >
      <div
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          position: "relative",
        }}
        className="transition-all"
      >
        <iframe
          ref={iframeRef}
          title={title}
          data-viewport={viewport}
          data-target-width={targetWidth}
          style={{
            width: `${targetWidth}px`,
            minWidth: `${targetWidth}px`,
            maxWidth: "none",
            height: `${iframeHeight}px`,
            minHeight: `${iframeHeight}px`,
            border: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="bg-white shadow-md rounded-lg overflow-auto"
        >
          {mountNode ? createPortal(children, mountNode) : null}
        </iframe>
      </div>
    </div>
  );
}

export type HighFidelityPreviewProps = {
  draftSections: NormalizedPublicSiteSections;
  liveSections: NormalizedPublicSiteSections;
  activeSectionKey?: string;
  branches?: BranchRow[];
  services?: PublicCatalogService[];
  initialMode?: PreviewMode;
  initialViewport?: PreviewViewport;
  onRevertToLive?: () => void;
  canRevert?: boolean;
};

export function HighFidelityPreview({
  draftSections,
  liveSections,
  branches = [],
  services = [],
  initialMode = "draft",
  initialViewport = "desktop",
}: HighFidelityPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>(initialMode);
  const [viewport, setViewport] = useState<PreviewViewport>(initialViewport);

  // Parity rule: Mobile preview filters for public-safe services; Desktop/Tablet receives the public service dataset.
  const mobileServices = services.filter(isPublicSafeService);
  const desktopServices = services;

  const activeSections = mode === "live" ? liveSections : draftSections;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-xs overflow-hidden">
      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-2.5">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setMode("draft")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "draft"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
          >
            <Pencil className="h-3 w-3" />
            Draft
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "live"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
          >
            <Globe className="h-3 w-3" />
            Live
          </button>
          <button
            type="button"
            onClick={() => setMode("compare")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "compare"
                ? "bg-[var(--cs-primary)] text-white shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
          >
            <Columns2 className="h-3 w-3" />
            Compare
          </button>
        </div>

        {/* Viewport Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`p-1.5 rounded-md transition ${
              viewport === "desktop"
                ? "bg-[var(--cs-surface-warm)] text-[var(--cs-primary)] font-bold shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
            title="Desktop Viewport (1280px)"
            aria-label="Desktop Viewport"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("tablet")}
            className={`p-1.5 rounded-md transition ${
              viewport === "tablet"
                ? "bg-[var(--cs-surface-warm)] text-[var(--cs-primary)] font-bold shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
            title="Tablet Viewport (768px)"
            aria-label="Tablet Viewport"
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`p-1.5 rounded-md transition ${
              viewport === "mobile"
                ? "bg-[var(--cs-surface-warm)] text-[var(--cs-primary)] font-bold shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
            title="Mobile Viewport (375px)"
            aria-label="Mobile Viewport"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 py-1.5 text-[11px] text-[var(--cs-text-secondary)]">
        <div>
          {mode === "draft" && (
            <span className="inline-flex items-center gap-1 text-purple-700 font-medium dark:text-purple-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
              In-Memory Working Draft
            </span>
          )}
          {mode === "live" && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Published Live Version
            </span>
          )}
          {mode === "compare" && (
            <span className="inline-flex items-center gap-1 text-[var(--cs-text)] font-medium">
              Comparing Live vs Working Draft
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] uppercase text-[var(--cs-text-muted)]">
          {viewport === "desktop"
            ? "1280px Desktop"
            : viewport === "tablet"
              ? "768px Tablet"
              : "375px Mobile"}
        </div>
      </div>

      {/* ── Preview Frame / Scroll Container ─────────────────────── */}
      <div className="flex-1 overflow-auto bg-stone-100 p-4 dark:bg-stone-900/60 flex justify-center">
        {mode === "compare" ? (
          <div className="grid w-full gap-4 lg:grid-cols-2 max-w-6xl">
            {/* Live side */}
            <div className="rounded-lg border border-emerald-300/60 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border-b border-emerald-200">
                [LIVE] Published Site
              </div>
              <div className="flex-1 overflow-auto max-h-[700px]">
                <IsolatedViewportFrame
                  viewport={viewport}
                  title={`[LIVE] Published Site ${viewport.toUpperCase()} Preview`}
                >
                  {viewport === "mobile" ? (
                    <PublicMobileHomeRenderer
                      sections={liveSections}
                      branches={branches}
                      services={mobileServices}
                    />
                  ) : (
                    <HomePageSectionsRenderer
                      sections={liveSections}
                      branches={branches}
                      services={desktopServices}
                    />
                  )}
                </IsolatedViewportFrame>
              </div>
            </div>

            {/* Draft side */}
            <div className="rounded-lg border border-purple-300/60 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 border-b border-purple-200">
                [DRAFT] Working Editor State
              </div>
              <div className="flex-1 overflow-auto max-h-[700px]">
                <IsolatedViewportFrame
                  viewport={viewport}
                  title={`[DRAFT] Working Editor State ${viewport.toUpperCase()} Preview`}
                >
                  {viewport === "mobile" ? (
                    <PublicMobileHomeRenderer
                      sections={draftSections}
                      branches={branches}
                      services={mobileServices}
                    />
                  ) : (
                    <HomePageSectionsRenderer
                      sections={draftSections}
                      branches={branches}
                      services={desktopServices}
                    />
                  )}
                </IsolatedViewportFrame>
              </div>
            </div>
          </div>
        ) : (
          <IsolatedViewportFrame
            viewport={viewport}
            title={`High-Fidelity ${viewport.toUpperCase()} Preview`}
          >
            {viewport === "mobile" ? (
              <PublicMobileHomeRenderer
                sections={activeSections}
                branches={branches}
                services={mobileServices}
              />
            ) : (
              <HomePageSectionsRenderer
                sections={activeSections}
                branches={branches}
                services={desktopServices}
              />
            )}
          </IsolatedViewportFrame>
        )}
      </div>
    </div>
  );
}
