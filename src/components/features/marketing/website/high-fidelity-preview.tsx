"use client";

import { useState } from "react";
import {
  Check,
  Columns2,
  Globe,
  Home,
  MapPin,
  MessageCircle,
  Monitor,
  Pencil,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { heroProofPoints, quickTrustPoints } from "@/lib/public/public-site-data";
import { MobileHomeHeroCarousel } from "@/components/public/mobile/mobile-home-hero-carousel";
import { MobileFinalCta } from "@/components/public/mobile/mobile-final-cta";

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

const proofIcons = [ShieldCheck, Home, MapPin, MessageCircle] as const;

function PublicSiteDesktopPreview({
  sections,
  activeSectionKey,
  branches: _branches = [],
}: {
  sections: NormalizedPublicSiteSections;
  activeSectionKey?: string;
  branches?: BranchRow[];
}) {
  const {
    hero,
    about,
    quoteBanner,
    beforeYouBook,
    signatureServices,
    gallery: _gallery,
  } = sections;

  return (
    <div className="bg-[#FCFAF5] text-[#163A2B] font-sans antialiased text-left selection:bg-[#E8D5A3]">
      {/* ── 1. Hero ────────────────────────────────────────────── */}
      {hero.isEnabled && (
        <section
          id="preview-hero"
          className={`relative overflow-hidden bg-[#10261D] pt-20 pb-16 transition-all ${
            activeSectionKey === "hero" ? "ring-2 ring-[var(--cs-primary)] ring-offset-2" : ""
          }`}
        >
          <div className="absolute inset-0">
            {hero.imageUrl ? (
              <img
                src={hero.imageUrl}
                alt="Cradle spa hero"
                className="h-full w-full object-cover opacity-70"
              />
            ) : (
              <div className="h-full w-full bg-[#10261D]" />
            )}
            <div className="absolute inset-0 bg-[#10261D]/55" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.96)_0%,rgba(16,38,29,0.76)_48%,rgba(16,38,29,0.38)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,#F7F3EB_0%,rgba(247,243,235,0)_100%)]" />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[1.1fr_0.7fr]">
            <div className="max-w-2xl">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
                {hero.brandEyebrow}
              </p>
              <h1
                className="text-3xl font-medium leading-[1.08] text-[#FCFAF5] sm:text-5xl"
                style={{ fontFamily: "serif" }}
              >
                {hero.title}
              </h1>
              <p className="mt-4 max-w-xl text-[13px] leading-6 text-[#F7F3EB]/80 sm:text-sm">
                {hero.subtitle}
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {hero.ctaLabel && (
                  <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#C8A96B] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10261D] shadow-sm">
                    {hero.ctaLabel}
                  </span>
                )}
                {hero.secondaryCtaLabel && (
                  <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#F7F3EB]/30 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5]">
                    {hero.secondaryCtaLabel}
                  </span>
                )}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-2">
                {heroProofPoints.map((point) => (
                  <div
                    key={point.id}
                    className="rounded-md border border-[#F7F3EB]/14 bg-[#10261D]/50 p-2.5 backdrop-blur-xs"
                  >
                    <p className="text-[11px] font-semibold text-[#FCFAF5]">{point.label}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#F7F3EB]/65">{point.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative ml-auto max-w-xs">
                <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-[#E8D5A3]/24 shadow-xl">
                  {hero.secondaryImageUrl ? (
                    <img
                      src={hero.secondaryImageUrl}
                      alt="Cradle spa atmosphere"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#163A2B] text-xs text-[#E8D5A3]">
                      Portrait image
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. About / Spa Philosophy ──────────────────────────── */}
      {about.isEnabled && (
        <section
          id="preview-about"
          className={`bg-[#F7F3EB] py-14 transition-all ${
            activeSectionKey === "about" ? "ring-2 ring-[var(--cs-primary)] ring-offset-2" : ""
          }`}
        >
          <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B68A3C]">
                {about.subtitle}
              </p>
              <h2
                className="text-2xl font-medium leading-tight text-[#163A2B] sm:text-3xl"
                style={{ fontFamily: "serif" }}
              >
                {about.title}
              </h2>
              <div className="mt-4 space-y-3 text-[13px] leading-6 text-[#5F6F63]">
                {about.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-[1fr_0.75fr]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-stone-200">
                {about.imageUrl && (
                  <img
                    src={about.imageUrl}
                    alt="About Cradle"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="grid gap-2.5">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-stone-200">
                  {about.secondaryImageUrl && (
                    <img
                      src={about.secondaryImageUrl}
                      alt="Spa detail"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex items-center rounded-md bg-[#163A2B] p-4 text-[#E8D5A3]">
                  <p className="text-sm italic" style={{ fontFamily: "serif" }}>
                    &ldquo;Rest is not a reward. It is part of care.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Quick Trust Highlights (Static C) ──────────────── */}
      <section className="bg-[#FCFAF5] py-10 border-y border-[#EDE4D3]/60">
        <div className="mx-auto grid max-w-6xl gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickTrustPoints.map((point, index) => {
            const Icon = proofIcons[index % proofIcons.length]!;
            return (
              <div key={point.id} className="rounded-md border border-[#EDE4D3] bg-white p-4">
                <Icon className="mb-2 h-4 w-4 text-[#B68A3C]" />
                <h3 className="text-xs font-semibold text-[#163A2B]">{point.label}</h3>
                <p className="mt-1 text-[11px] leading-4 text-[#6B7A6F]">{point.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. Signature Services Presentation ────────────────── */}
      {signatureServices.isVisible && (
        <section
          id="preview-services"
          className={`bg-[#F7F3EB] py-14 transition-all ${
            activeSectionKey === "signature_services"
              ? "ring-2 ring-[var(--cs-primary)] ring-offset-2"
              : ""
          }`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8 max-w-xl">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B68A3C]">
                {signatureServices.subtitle}
              </p>
              <h2
                className="text-2xl font-medium leading-tight text-[#163A2B] sm:text-3xl"
                style={{ fontFamily: "serif" }}
              >
                {signatureServices.title}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#6B7A6F]">{signatureServices.body}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {["Massage Care", "Foot & Body Scrub", "Divine Renewal Packages"].map((cat, i) => (
                <div
                  key={cat}
                  className="overflow-hidden rounded-md border border-[#EDE4D3] bg-white p-4"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#B68A3C]">
                    Category 0{i + 1}
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-[#163A2B]">{cat}</h3>
                  <p className="mt-1 text-[11px] text-[#6B7A6F]">
                    Calm, restorative treatments curated for in-spa and home service booking in
                    Bacolod.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 5. Quote Banner / Final CTA ───────────────────────── */}
      {quoteBanner.isEnabled && (
        <section
          id="preview-quote-banner"
          className={`relative overflow-hidden bg-[#0D2B20] py-16 text-[#FCFAF5] transition-all ${
            activeSectionKey === "quote_banner"
              ? "ring-2 ring-[var(--cs-primary)] ring-offset-2"
              : ""
          }`}
        >
          <div className="absolute inset-0">
            {quoteBanner.imageUrl && (
              <img
                src={quoteBanner.imageUrl}
                alt="Quote banner"
                className="h-full w-full object-cover opacity-35"
              />
            )}
            <div className="absolute inset-0 bg-[#0D2B20]/70" />
          </div>
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            {quoteBanner.subtitle && (
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
                {quoteBanner.subtitle}
              </p>
            )}
            <h2
              className="text-2xl font-medium leading-tight sm:text-4xl text-[#FCFAF5]"
              style={{ fontFamily: "serif" }}
            >
              {quoteBanner.title}
            </h2>
            {quoteBanner.body && (
              <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-[#F7F3EB]/80">
                {quoteBanner.body}
              </p>
            )}
            {quoteBanner.ctaLabel && (
              <div className="mt-6">
                <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#C8A96B] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10261D]">
                  {quoteBanner.ctaLabel}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 6. Before You Book ────────────────────────────────── */}
      {beforeYouBook.isEnabled && (
        <section
          id="preview-before-you-book"
          className={`bg-[#F7F3EB] py-14 transition-all ${
            activeSectionKey === "before_you_book"
              ? "ring-2 ring-[var(--cs-primary)] ring-offset-2"
              : ""
          }`}
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-8">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B68A3C]">
                {beforeYouBook.subtitle}
              </p>
              <h2
                className="text-2xl font-medium leading-tight text-[#163A2B] sm:text-3xl"
                style={{ fontFamily: "serif" }}
              >
                {beforeYouBook.title}
              </h2>
              {beforeYouBook.body && (
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[#5F6F63]">
                  {beforeYouBook.body}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {beforeYouBook.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-md border border-[#EDE4D3] bg-white p-3.5"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8D5A3]/40 text-[#B68A3C]">
                    <Check className="h-3 w-3" />
                  </div>
                  <p className="text-xs leading-5 text-[#163A2B]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PublicSiteMobilePreview({
  sections,
  branches: _branches = [],
  services: _services = [],
}: {
  sections: NormalizedPublicSiteSections;
  branches?: BranchRow[];
  services?: PublicCatalogService[];
}) {
  return (
    <div className="mx-auto max-w-[375px] bg-[#061912] text-[#F3E9D2] font-sans antialiased text-left">
      {/* Hero Carousel */}
      <MobileHomeHeroCarousel hero={sections.hero} />

      {/* Main calm flow */}
      <div className="-mt-4 rounded-t-2xl bg-[#061912] pt-4 px-4 space-y-6">
        {/* About summary */}
        {sections.about.isEnabled && (
          <div className="rounded-xl border border-[#C8A96A]/20 bg-[#0D2B20] p-4 text-xs leading-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A96A]">
              {sections.about.subtitle}
            </span>
            <h3 className="mt-1 text-sm font-semibold text-white" style={{ fontFamily: "serif" }}>
              {sections.about.title}
            </h3>
            <p className="mt-2 text-[#F3E9D2]/80">{sections.about.body}</p>
          </div>
        )}

        {/* Final CTA */}
        {sections.quoteBanner.isEnabled && <MobileFinalCta quoteBanner={sections.quoteBanner} />}

        {/* Before You Book */}
        {sections.beforeYouBook.isEnabled && (
          <div className="rounded-xl border border-[#C8A96A]/20 bg-[#0D2B20] p-4 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8A96A]">
              {sections.beforeYouBook.subtitle}
            </span>
            <h3 className="mt-1 text-sm font-semibold text-white">
              {sections.beforeYouBook.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {sections.beforeYouBook.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-[#F3E9D2]/80">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#C8A96A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function HighFidelityPreview({
  draftSections,
  liveSections,
  activeSectionKey,
  branches = [],
  services = [],
  initialMode = "draft",
  initialViewport = "desktop",
  onRevertToLive: _onRevertToLive,
  canRevert: _canRevert = false,
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
                  <PublicSiteMobilePreview
                    sections={liveSections}
                    branches={branches}
                    services={services}
                  />
                ) : (
                  <PublicSiteDesktopPreview sections={liveSections} branches={branches} />
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
                  <PublicSiteMobilePreview
                    sections={draftSections}
                    branches={branches}
                    services={services}
                  />
                ) : (
                  <PublicSiteDesktopPreview
                    sections={draftSections}
                    activeSectionKey={activeSectionKey}
                    branches={branches}
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
              <PublicSiteMobilePreview
                sections={activeSections}
                branches={branches}
                services={services}
              />
            ) : (
              <PublicSiteDesktopPreview
                sections={activeSections}
                activeSectionKey={activeSectionKey}
                branches={branches}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
