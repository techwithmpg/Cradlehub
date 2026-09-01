"use client";

import { useState } from "react";
import { Columns2, Globe, Monitor, Pencil, Smartphone, Tablet } from "lucide-react";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { HomePageSectionsRenderer } from "@/components/public/home-page-sections";
import { PublicMobileHomeRenderer } from "@/components/public/mobile/public-mobile-home";

export type PreviewMode = "draft" | "live" | "compare";
export type PreviewViewport = "desktop" | "tablet" | "mobile";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

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
                ? "bg-[var(--cs-primary)] text-white shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Draft
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "live"
                ? "bg-[var(--cs-primary)] text-white shadow-xs"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
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
            <Columns2 className="h-3.5 w-3.5" />
            Compare
          </button>
        </div>

        {/* Viewport Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`p-1.5 rounded-md text-xs transition ${
              viewport === "desktop"
                ? "bg-[var(--cs-primary)] text-white"
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
            className={`p-1.5 rounded-md text-xs transition ${
              viewport === "tablet"
                ? "bg-[var(--cs-primary)] text-white"
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
            className={`p-1.5 rounded-md text-xs transition ${
              viewport === "mobile"
                ? "bg-[var(--cs-primary)] text-white"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            }`}
            title="Mobile Viewport (375px)"
            aria-label="Mobile Viewport"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status / Indicator */}
        <div className="flex items-center gap-2">
          {mode === "draft" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
              Draft Preview (In-Memory)
            </span>
          )}
          {mode === "live" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Published Live Version
            </span>
          )}
          {mode === "compare" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              Comparing Live vs Working Draft
            </span>
          )}
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
                {viewport === "mobile" ? (
                  <PublicMobileHomeRenderer
                    sections={liveSections}
                    branches={branches}
                    services={services}
                  />
                ) : (
                  <HomePageSectionsRenderer
                    sections={liveSections}
                    branches={branches}
                    services={services}
                  />
                )}
              </div>
            </div>

            {/* Draft side */}
            <div className="rounded-lg border border-purple-300/60 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 border-b border-purple-200">
                [DRAFT] Working Editor State
              </div>
              <div className="flex-1 overflow-auto max-h-[700px]">
                {viewport === "mobile" ? (
                  <PublicMobileHomeRenderer
                    sections={draftSections}
                    branches={branches}
                    services={services}
                  />
                ) : (
                  <HomePageSectionsRenderer
                    sections={draftSections}
                    branches={branches}
                    services={services}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`transition-all shadow-md rounded-lg overflow-hidden bg-white ${
              viewport === "desktop"
                ? "w-full max-w-5xl"
                : viewport === "tablet"
                  ? "w-[768px] max-w-full"
                  : "w-[375px]"
            }`}
          >
            {viewport === "mobile" ? (
              <PublicMobileHomeRenderer
                sections={activeSections}
                branches={branches}
                services={services}
              />
            ) : (
              <HomePageSectionsRenderer
                sections={activeSections}
                branches={branches}
                services={services}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
