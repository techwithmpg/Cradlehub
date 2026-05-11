"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ShowcaseSlide = {
  id: string;
  image: string;
  title: string;
  description: string;
  href: string;
};

type ServiceShowcaseCarouselProps = {
  slides: ShowcaseSlide[];
  eyebrow?: string;
  heading?: string;
  subheading?: string;
};

export function ServiceShowcaseCarousel({
  slides,
  eyebrow,
  heading,
  subheading,
}: ServiceShowcaseCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActive = useCallback(() => {
    const el = containerRef.current;
    if (!el || slides.length === 0) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;

    const containerCenter = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;

    children.forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(containerCenter - childCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });

    setActiveIndex(closest);
  }, [slides.length]);

  const goTo = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const child = children[index];
    if (!child) return;

    const scrollLeft =
      child.offsetLeft - el.clientWidth / 2 + child.offsetWidth / 2;
    el.scrollTo({ left: scrollLeft, behavior: "smooth" });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateActive, { passive: true });
    requestAnimationFrame(updateActive);
    return () => el.removeEventListener("scroll", updateActive);
  }, [updateActive]);

  if (slides.length === 0) return null;

  return (
    <div>
      {(eyebrow || heading || subheading) && (
        <div className="mb-6 px-4 md:mb-8 md:px-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B68A3C] md:text-[11px] md:tracking-[0.25em]">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="mt-1 text-[17px] font-semibold text-[#022316] md:mt-2 md:text-3xl md:font-medium md:leading-tight md:text-[#163A2B]">
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="mt-2 max-w-md text-[12px] leading-5 text-[#5F6F63] md:text-[14px] md:leading-7 md:text-[#6B7A6F]">
              {subheading}
            </p>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => (
          <article
            key={slide.id}
            className="w-[85vw] shrink-0 snap-center px-1.5 first:pl-4 last:pr-4 md:w-[320px] md:px-2 md:first:pl-0 md:last:pr-0 lg:w-[380px]"
          >
            <div className="group relative overflow-hidden rounded-[16px] md:rounded-[12px]">
              <Link href={slide.href} className="block">
                <div className="relative aspect-[4/3] overflow-hidden md:aspect-[16/10]">
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 85vw, 380px"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,35,22,0.78)_0%,rgba(2,35,22,0.25)_50%,rgba(2,35,22,0.06)_100%)]" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <h3 className="text-[15px] font-semibold text-[#FCFAF5] md:text-[16px]">
                    {slide.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#F7F3EB]/80 md:text-[12px] md:leading-5">
                    {slide.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#E0B84B] md:mt-4">
                    Explore
                    <ArrowRight
                      className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center gap-2 pt-4 md:pt-5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-[6px] rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-5 bg-[#B68A3C]"
                : "w-[6px] bg-[#B68A3C]/30 hover:bg-[#B68A3C]/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
