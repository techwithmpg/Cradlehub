"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { NormalizedHeroSection } from "@/lib/public/normalized-sections";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileHomeHeroCarouselProps = {
  hero?: NormalizedHeroSection;
  siteImages?: Record<string, string>;
};

export function MobileHomeHeroCarousel({
  hero,
  siteImages,
}: MobileHomeHeroCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  if (hero && !hero.isEnabled) {
    return null;
  }

  const title = hero?.title || "Where calm\nmeets care.";
  const subtitle =
    hero?.subtitle ||
    "Expert care, premium treatments, and a peaceful escape — crafted for your total well-being.";
  const primaryLabel = hero?.ctaLabel || "Book Appointment";
  const primaryHref = hero?.ctaHref || "/book";
  const secondaryLabel = hero?.secondaryCtaLabel || "View Services";
  const secondaryHref = hero?.secondaryCtaHref || "/services";

  const slideImages = [
    hero?.mobileImageUrl ||
      siteImages?.mobile_hero_primary ||
      hero?.imageUrl ||
      SPA_IMAGES.heroPortrait,
    siteImages?.mobile_hero_secondary ||
      hero?.secondaryImageUrl ||
      SPA_IMAGES.aromatherapy,
    siteImages?.mobile_hero_tertiary || SPA_IMAGES.hotStone,
  ];
  const currentImage = slideImages[activeSlide] || slideImages[0];

  return (
    <section className="relative overflow-hidden bg-[#10261D] pt-6 text-[#FAF5E9]">
      {/* Top Botanical Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#D4B57A]/12 blur-3xl"
      />

      <div className="relative mx-auto max-w-md px-5 pb-12 text-center">
        {/* Circular Gold-Framed Sanctuary Portrait */}
        <div className="mx-auto mb-6 flex justify-center">
          <div className="relative h-56 w-56 overflow-hidden rounded-full border-2 border-[#D4B57A]/75 bg-[#163A2B] shadow-[0_18px_40px_-10px_rgba(0,0,0,0.55)]">
            <img
              src={currentImage}
              alt={
                hero?.mobileImageAltText ||
                hero?.imageAltText ||
                "Cradle Wellness Living signature treatment"
              }
              fetchPriority="high"
              className="h-full w-full object-cover"
              style={{
                objectPosition: hero?.mobileImagePosition || "50% 35%",
              }}
            />
          </div>
        </div>

        <p className="text-[10px] font-semibold tracking-[0.26em] text-[#D4B57A] uppercase">
          Wellness · Beauty · Relaxation
        </p>

        <h1 className="mt-2.5 whitespace-pre-line font-serif text-[32px] font-medium leading-[1.12] text-[#FAF5E9] [font-family:var(--sp-font-display)] text-balance">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-[#CFD9D1] [text-wrap:pretty]">
          {subtitle}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href={primaryHref}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#D4B57A] px-5 py-3 text-sm font-semibold text-[#10261D] shadow-sm transition hover:bg-[#E0C38A]"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>{primaryLabel}</span>
          </Link>

          {secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#D4B57A]/50 bg-[#163A2B]/60 px-5 py-2.5 text-sm font-medium text-[#FAF5E9] transition hover:border-[#D4B57A]"
            >
              <span>{secondaryLabel}</span>
            </Link>
          )}
        </div>

        {/* Interactive Slide Dots */}
        <div
          className="mt-6 flex items-center justify-center gap-2"
          role="group"
          aria-label="Hero showcase slides"
        >
          {slideImages.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlide(idx)}
              aria-label={`Show hero image ${idx + 1}`}
              aria-pressed={activeSlide === idx}
              className={`h-2 rounded-full transition-all ${
                activeSlide === idx
                  ? "w-6 bg-[#D4B57A]"
                  : "w-2 bg-white/30 hover:bg-white/55"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Curved Cream Wave Transition */}
      <div aria-hidden="true" className="relative h-6 w-full overflow-hidden">
        <svg
          viewBox="0 0 400 24"
          preserveAspectRatio="none"
          className="h-full w-full fill-[#F7F3EB]"
        >
          <path d="M0,24 Q200,0 400,24 L400,24 L0,24 Z" />
        </svg>
      </div>
    </section>
  );
}
