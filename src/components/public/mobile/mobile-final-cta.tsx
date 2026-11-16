import React from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { NormalizedQuoteBannerSection } from "@/lib/public/normalized-sections";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileFinalCtaProps = {
  quoteBanner?: NormalizedQuoteBannerSection;
  siteImages?: Record<string, string>;
};

export function MobileFinalCta({ quoteBanner, siteImages }: MobileFinalCtaProps) {
  if (quoteBanner && !quoteBanner.isEnabled) {
    return null;
  }

  const isStandaloneFallback = !quoteBanner;
  const bgImage =
    siteImages?.mobile_final_cta_ambient ||
    quoteBanner?.imageUrl ||
    SPA_IMAGES.ctaBanner;

  const eyebrow = isStandaloneFallback
    ? "Book your pause"
    : quoteBanner.subtitle || "Book your pause";
  const heading = isStandaloneFallback
    ? "Your calm is waiting"
    : quoteBanner.title;
  const body = isStandaloneFallback ? "Book your pause today." : quoteBanner.body;
  const ctaLabel = isStandaloneFallback ? "Book Now" : quoteBanner.ctaLabel;
  const ctaHref = quoteBanner?.ctaHref || "/book";

  return (
    <section className="relative overflow-hidden border-t border-[#D4B57A]/20 bg-[#05140E] px-5 py-12 text-center text-[#FAF5E9]">
      <img
        src={bgImage}
        alt="Calm spa candlelight ambiance"
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071A12]/80 via-[#05140E]/65 to-[#05140E]"
      />
      <div className="relative z-10 mx-auto max-w-sm">
        <p className="text-[10px] font-semibold tracking-[0.24em] text-[#D4B57A] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-serif text-2xl font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
          {heading}
        </h2>
        {body && (
          <p className="mt-2 text-xs leading-relaxed text-[#D0DBD2]">{body}</p>
        )}
        {ctaLabel && (
          <div className="mt-5">
            <Link
              href={ctaHref}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#D4B57A] px-6 py-2.5 text-sm font-semibold text-[#10261D] shadow-sm transition hover:bg-[#E0C38A]"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{ctaLabel}</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
