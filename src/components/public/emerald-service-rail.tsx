"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import { ServiceImage } from "@/components/public/service-image";

type EmeraldServiceRailProps = {
  services: PublicCatalogService[];
};

const DRIFT_SPEED_PX_PER_SEC = 22;

function selectFeaturedRailServices(services: PublicCatalogService[]): PublicCatalogService[] {
  const safe = services.filter(
    (s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip
  );
  if (safe.length <= 10) return safe;

  // Diversify across categories first, then fill up to 10 cards.
  const picked: PublicCatalogService[] = [];
  const seenIds = new Set<string>();
  const byCategory = new Map<string, PublicCatalogService[]>();

  for (const s of safe) {
    const bucket = byCategory.get(s.categoryName) ?? [];
    bucket.push(s);
    byCategory.set(s.categoryName, bucket);
  }

  let round = 0;
  while (picked.length < 10) {
    let addedInRound = false;
    for (const list of byCategory.values()) {
      const candidate = list[round];
      if (candidate && !seenIds.has(candidate.id)) {
        seenIds.add(candidate.id);
        picked.push(candidate);
        addedInRound = true;
        if (picked.length >= 10) break;
      }
    }
    if (!addedInRound) break;
    round += 1;
  }

  return picked;
}

export function EmeraldServiceRail({ services }: EmeraldServiceRailProps) {
  const railServices = useMemo(() => selectFeaturedRailServices(services), [services]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const posRef = useRef(0);
  const hoverPausedRef = useRef(false);
  const focusPausedRef = useRef(false);
  const visibleRef = useRef(true);
  const tabVisibleRef = useRef(true);
  const suppressClickUntilRef = useRef(0);
  const manualPauseRef = useRef(false);

  const dragRef = useRef<{
    startX: number;
    startPos: number;
    vx: number;
    inertia: boolean;
    moved: boolean;
    samples: Array<{ x: number; t: number }>;
  } | null>(null);

  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    manualPauseRef.current = manuallyPaused;
  }, [manuallyPaused]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const getHalfWidth = () => {
    const node = trackRef.current;
    if (!node || railServices.length === 0) return 0;
    const first = node.children[0] as HTMLElement | undefined;
    const secondCopyFirst = node.children[railServices.length] as HTMLElement | undefined;
    if (!first || !secondCopyFirst) return node.scrollWidth / 2;
    return secondCopyFirst.offsetLeft - first.offsetLeft;
  };

  const getCardStep = () => {
    const node = trackRef.current;
    if (!node) return 244;
    const first = node.children[0] as HTMLElement | undefined;
    const second = node.children[1] as HTMLElement | undefined;
    if (!first || !second) return 244;
    return second.offsetLeft - first.offsetLeft;
  };

  const applyTransform = () => {
    const node = trackRef.current;
    if (!node) return;
    node.style.transform = `translate3d(${-posRef.current}px, 0, 0)`;
  };

  const wrapPosition = () => {
    const max = getHalfWidth();
    if (max <= 0) return;
    posRef.current = ((posRef.current % max) + max) % max;
  };

  useEffect(() => {
    const node = trackRef.current;
    const container = sectionRef.current;
    if (!node || railServices.length < 2) return;

    // Observe visibility so the RAF loop skips updates when off-screen or tab-hidden.
    const io =
      typeof IntersectionObserver !== "undefined" && container
        ? new IntersectionObserver(
            ([entry]) => {
              visibleRef.current = Boolean(entry?.isIntersecting);
            },
            { threshold: 0.05 }
          )
        : null;
    if (io && container) io.observe(container);

    const onVisibilityChange = () => {
      tabVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    let frame = 0;
    let last = 0;
    applyTransform();

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!last) {
        last = now;
        return;
      }
      const dt = Math.min(64, Math.max(0, now - last)) / 1000;
      last = now;

      const d = dragRef.current;
      if (d && d.inertia) {
        posRef.current -= d.vx * dt;
        d.vx *= Math.pow(0.02, dt);
        wrapPosition();
        applyTransform();
        if (Math.abs(d.vx) < 8) {
          d.inertia = false;
          dragRef.current = null;
        }
        return;
      }

      if (
        d ||
        reducedMotion ||
        manualPauseRef.current ||
        hoverPausedRef.current ||
        focusPausedRef.current ||
        !visibleRef.current ||
        !tabVisibleRef.current
      ) {
        return;
      }

      const max = getHalfWidth();
      if (max <= 0) return;
      posRef.current += DRIFT_SPEED_PX_PER_SEC * dt;
      wrapPosition();
      applyTransform();
    };

    frame = requestAnimationFrame((now) => {
      last = now;
      frame = requestAnimationFrame(tick);
    });

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return;
      node.classList.add("dragging");
      dragRef.current = {
        startX: event.clientX,
        startPos: posRef.current,
        vx: 0,
        inertia: false,
        moved: false,
        samples: [{ x: event.clientX, t: performance.now() }],
      };
      node.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.inertia) return;
      const now = performance.now();
      d.samples.push({ x: event.clientX, t: now });
      while (d.samples.length > 2 && now - d.samples[0]!.t > 120) {
        d.samples.shift();
      }
      const first = d.samples[0]!;
      const span = Math.max(1, now - first.t) / 1000;
      d.vx = Math.max(-900, Math.min(900, (event.clientX - first.x) / span));

      if (Math.abs(event.clientX - d.startX) > 6) {
        d.moved = true;
      }
      posRef.current = d.startPos - (event.clientX - d.startX);
      wrapPosition();
      applyTransform();
    };

    const onPointerUp = (event: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      node.classList.remove("dragging");
      try {
        node.releasePointerCapture?.(event.pointerId);
      } catch {
        // Ignore if capture was already released.
      }
      if (!d.moved) {
        dragRef.current = null;
        return;
      }
      suppressClickUntilRef.current = performance.now() + 260;
      if (reducedMotion || Math.abs(d.vx) < 25) {
        dragRef.current = null;
        return;
      }
      dragRef.current = { ...d, inertia: true };
    };

    const onPointerCancel = () => {
      node.classList.remove("dragging");
      dragRef.current = null;
    };

    const onPointerEnter = () => {
      hoverPausedRef.current = true;
    };
    const onPointerLeave = () => {
      hoverPausedRef.current = false;
    };
    const onFocusIn = () => {
      focusPausedRef.current = true;
    };
    const onFocusOut = () => {
      focusPausedRef.current = false;
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", onPointerCancel);
    node.addEventListener("pointerenter", onPointerEnter);
    node.addEventListener("pointerleave", onPointerLeave);
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointercancel", onPointerCancel);
      node.removeEventListener("pointerenter", onPointerEnter);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.removeEventListener("focusin", onFocusIn);
      node.removeEventListener("focusout", onFocusOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railServices.length, reducedMotion]);

  if (railServices.length < 2) return null;

  const items = [...railServices, ...railServices];

  const handleStep = (direction: -1 | 1) => {
    const step = getCardStep();
    posRef.current += direction * step;
    wrapPosition();
    applyTransform();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLUListElement>) => {
    const node = trackRef.current;
    if (
      node?.classList.contains("dragging") ||
      performance.now() < suppressClickUntilRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const isAutoPlaying = !reducedMotion && !manuallyPaused;

  return (
    <div
      ref={sectionRef}
      role="region"
      aria-label="Featured wellness treatments carousel"
      className="relative z-10 w-full"
    >
      {/* Subtle accessible rail controls (WCAG 2.2.2 pause/play + keyboard Prev/Next) */}
      <div className="mx-auto mb-2.5 flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#E8D5A3]/90 uppercase">
          Drag or select a treatment
        </p>
        <div className="flex items-center gap-1.5">
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setManuallyPaused((p) => !p)}
              aria-label={isAutoPlaying ? "Pause treatment rail movement" : "Resume treatment rail movement"}
              className="eg-glass-pill flex h-8 w-8 items-center justify-center rounded-full text-[#E8D5A3] transition hover:border-[#E8D5A3]/65 hover:bg-[#14402E]"
            >
              {isAutoPlaying ? (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleStep(-1)}
            aria-label="Previous treatments"
            className="eg-glass-pill flex h-8 w-8 items-center justify-center rounded-full text-[#FAF5E9] transition hover:border-[#E8D5A3]/65 hover:bg-[#14402E]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            aria-label="Next treatments"
            className="eg-glass-pill flex h-8 w-8 items-center justify-center rounded-full text-[#FAF5E9] transition hover:border-[#E8D5A3]/65 hover:bg-[#14402E]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="eg-rail-viewport">
        <ul
          ref={trackRef}
          onClickCapture={handleClickCapture}
          className="eg-rail-track"
        >
          {items.map((service, index) => {
            const isDuplicate = index >= railServices.length;
            return (
              <li
                key={`${service.id}-${index}`}
                className="w-[188px] shrink-0 sm:w-[216px] lg:w-[234px]"
                aria-hidden={isDuplicate || undefined}
              >
                <Link
                  href={`/book?serviceId=${encodeURIComponent(service.id)}`}
                  tabIndex={isDuplicate ? -1 : undefined}
                  draggable={false}
                  className="eg-rail-face group block"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0A2419]">
                    <ServiceImage
                      src={service.imageUrl}
                      alt={isDuplicate ? "" : service.imageAlt || service.name}
                      category={service.categoryName}
                      fill
                      sizes="(min-width: 1024px) 240px, 200px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#05140E] via-[#05140E]/45 to-transparent"
                    />
                    <span className="absolute top-2.5 right-2.5 rounded-full border border-[#D4B57A]/35 bg-[#071D15]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#E8D5A3] backdrop-blur-xs">
                      {service.durationText} · {service.priceLabel}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3.5">
                      <p className="truncate text-[13px] font-semibold leading-snug text-[#FAF5E9]">
                        {service.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#D6E0D8]/90">
                        {service.shortDescription || service.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
