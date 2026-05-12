"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";

const SLIDES = [
  {
    src: SPA_IMAGES.hero,
    eyebrow: "Your Wellness Is Our Passion",
    title: "Rest. Renew.",
    accent: "Rejuvenate.",
    sub: "Experience the healing touch of Cradle.",
  },
  {
    src: SPA_IMAGES.heroPortrait,
    eyebrow: "Premium Spa Treatments",
    title: "Heal. Restore.",
    accent: "Flourish.",
    sub: "Thoughtful care for mind, body, and soul.",
  },
  {
    src: SPA_IMAGES.aboutSecondary,
    eyebrow: "Trusted by Our Clients",
    title: "Calm. Peace.",
    accent: "Serenity.",
    sub: "A space designed for your complete well-being.",
  },
] as const;

const AUTO_ADVANCE_MS = 5000;

export function MobileHomeHeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const goNext = useCallback(
    () => setCurrent((c) => (c + 1) % SLIDES.length),
    []
  );
  const goPrev = useCallback(
    () => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length),
    []
  );

  useEffect(() => {
    if (prefersReduced.current || paused) return;
    const id = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, goNext]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) { goNext(); } else { goPrev(); }
  }

  const slide = SLIDES[current]!;

  return (
    <section
      className="relative w-screen min-h-[100svh] overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Featured images carousel"
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.src}
          className={[
            "absolute inset-0 transition-opacity duration-700",
            i === current ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-hidden={i !== current ? "true" : undefined}
        >
          <Image
            src={s.src}
            alt=""
            fill
            priority={i === 0}
            className="object-cover"
            sizes="100vw"
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,15,10,0.95)_0%,rgba(3,27,18,0.65)_44%,rgba(2,15,10,0.08)_100%)]" />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-14 text-[#FCFAF5]">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E0B84B]">
          {slide.eyebrow}
        </p>
        <h1
          className="font-display text-[38px] font-medium leading-[1.04]"
        >
          {slide.title}{" "}
          <span className="text-[#E0B84B]">{slide.accent}</span>
        </h1>
        <p className="mt-3 max-w-[270px] text-[13px] leading-6 text-[#FCFAF5]/80">
          {slide.sub}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/book"
            className="flex min-h-12 items-center justify-center rounded-[8px] bg-linear-to-br from-[#E0B84B] to-[#D8A83F] text-[11px] font-bold uppercase tracking-[0.14em] text-[#022316]"
          >
            Book Now
          </Link>
          <Link
            href="/services"
            className="flex min-h-12 items-center justify-center rounded-[8px] border border-[#FCFAF5]/30 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FCFAF5]"
          >
            Our Services
          </Link>
        </div>
      </div>

      {/* Slide dots */}
      <div
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5"
        aria-hidden="true"
      >
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            className={[
              "h-1.5 rounded-full transition-all duration-300",
              i === current ? "w-5 bg-[#E0B84B]" : "w-1.5 bg-[#FCFAF5]/40",
            ].join(" ")}
          />
        ))}
      </div>
    </section>
  );
}
