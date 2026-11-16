"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MessageSquareQuote, Star } from "lucide-react";
import { EG_SURFACE, EmeraldSectionEyebrow } from "@/components/public/emerald-glass";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export type ApprovedGuestReview = {
  id: string;
  quote: string;
  guestDisplayName: string;
  rating?: number;
  visitLabel?: string;
  publishedAtLabel?: string;
  sourceLabel?: string;
};

/**
 * Customer Trust / Guest Feedback section.
 * Displays ONLY separately approved, publishable reviews when present.
 * Never fabricates reviews, star counts, or dates when no review feed exists.
 */
export function GuestExperiencesSection({
  reviews = [],
}: {
  reviews?: ApprovedGuestReview[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeReviews = reviews.filter(
    (item) => item.quote.trim().length > 0 && item.guestDisplayName.trim().length > 0
  );

  const goPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? safeReviews.length - 1 : prev - 1));
  };
  const goNext = () => {
    setActiveIndex((prev) => (prev === safeReviews.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="relative overflow-hidden border-t border-[#D4B57A]/15 py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <EmeraldSectionEyebrow>Guest Experiences</EmeraldSectionEyebrow>
              <h2 className={`${EG_SURFACE.heading} mt-2 text-2xl sm:text-3xl lg:text-4xl`}>
                Kind Words From Our Guests
              </h2>
            </div>

            {safeReviews.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous guest experience"
                  className="eg-glass-pill flex h-10 w-10 items-center justify-center rounded-full text-[#FAF5E9] transition hover:border-[#E8D5A3]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next guest experience"
                  className="eg-glass-pill flex h-10 w-10 items-center justify-center rounded-full text-[#FAF5E9] transition hover:border-[#E8D5A3]"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </ScrollReveal>

        {safeReviews.length === 0 ? (
          <ScrollReveal delay={80}>
            <div className={`${EG_SURFACE.glassCard} mt-8 flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8`}>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                  <MessageSquareQuote className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-semibold text-[#FAF5E9]">
                    Approved guest stories are published here as they are reviewed.
                  </p>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#CBD6CD]">
                    We only publish verified guest reviews explicitly approved for public display
                    across our Bacolod branches — private visit records are never shared publicly.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link href="/book" className={`${EG_SURFACE.goldButton} px-5 py-2.5 text-xs`}>
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Book Your Visit</span>
                </Link>
                <Link href="/services" className={`${EG_SURFACE.ghostButton} px-5 py-2.5 text-xs`}>
                  <span>Explore Services</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        ) : (
          <div className="mt-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {safeReviews.map((review, index) => {
                const isActive = index === activeIndex;
                return (
                  <article
                    key={review.id}
                    className={`${EG_SURFACE.glassCardLift} flex flex-col justify-between p-6 ${
                      isActive ? "border-[#E8D5A3]/55" : ""
                    }`}
                  >
                    <div>
                      {typeof review.rating === "number" && review.rating > 0 && (
                        <div className="mb-3 flex items-center gap-1 text-[#E5C98B]" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: Math.min(5, Math.round(review.rating)) }).map((_, sIdx) => (
                            <Star key={sIdx} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          ))}
                        </div>
                      )}
                      <blockquote className="text-sm leading-relaxed text-[#FAF5E9]">
                        &ldquo;{review.quote}&rdquo;
                      </blockquote>
                    </div>

                    <footer className="mt-5 flex items-center justify-between gap-2 border-t border-[#D4B57A]/15 pt-3 text-xs text-[#CBD6CD]">
                      <div>
                        <p className="font-semibold text-[#FAF5E9]">{review.guestDisplayName}</p>
                        {review.visitLabel && (
                          <p className="text-[11px] text-[#9CB0A3]">{review.visitLabel}</p>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-[#9CB0A3]">
                        {review.publishedAtLabel && <p>{review.publishedAtLabel}</p>}
                        {review.sourceLabel && <p>{review.sourceLabel}</p>}
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
