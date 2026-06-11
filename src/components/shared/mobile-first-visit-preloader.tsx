"use client";

import { useEffect, useState } from "react";
import { Leaf, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_PRELOADER_COOKIE, MOBILE_PRELOADER_SESSION_KEY } from "@/lib/public/mobile-preloader";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const MIN_VISIBLE_MS = 700;
const MAX_VISIBLE_MS = 1600;
const FADE_MS = 420;

type PreloaderStatus = "hidden" | "visible" | "leaving";

type MobileFirstVisitPreloaderProps = {
  initiallyVisible: boolean;
};

function setPreloaderActive(isActive: boolean) {
  if (isActive) {
    document.documentElement.dataset.mobilePreloader = "active";
    return;
  }

  delete document.documentElement.dataset.mobilePreloader;
}

function setSessionSeen() {
  document.cookie = `${MOBILE_PRELOADER_COOKIE}=1; path=/; SameSite=Lax`;

  try {
    window.sessionStorage.setItem(MOBILE_PRELOADER_SESSION_KEY, "1");
  } catch {
    // Storage can be restricted; the session cookie still prevents repeats.
  }
}

function hasSessionSeenFallback() {
  try {
    return window.sessionStorage.getItem(MOBILE_PRELOADER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function MobileFirstVisitPreloader({
  initiallyVisible,
}: MobileFirstVisitPreloaderProps) {
  const [status, setStatus] = useState<PreloaderStatus>(initiallyVisible ? "visible" : "hidden");

  useEffect(() => {
    if (!initiallyVisible) {
      return undefined;
    }

    const isMobileViewport = window.matchMedia(MOBILE_MEDIA_QUERY).matches;

    if (!isMobileViewport) {
      const hideTimerId = window.setTimeout(() => setStatus("hidden"), 0);
      return () => window.clearTimeout(hideTimerId);
    }

    if (hasSessionSeenFallback()) {
      setSessionSeen();
      const hideTimerId = window.setTimeout(() => setStatus("hidden"), 0);
      return () => window.clearTimeout(hideTimerId);
    }

    setPreloaderActive(true);
    setSessionSeen();

    const leaveTimerId = window.setTimeout(() => {
      setPreloaderActive(false);
      setStatus("leaving");
    }, MIN_VISIBLE_MS);
    const removeTimerId = window.setTimeout(
      () => setStatus("hidden"),
      MIN_VISIBLE_MS + FADE_MS
    );
    const fallbackTimerId = window.setTimeout(() => {
      setPreloaderActive(false);
      setStatus("hidden");
    }, MAX_VISIBLE_MS);

    return () => {
      window.clearTimeout(leaveTimerId);
      window.clearTimeout(removeTimerId);
      window.clearTimeout(fallbackTimerId);
      setPreloaderActive(false);
    };
  }, [initiallyVisible]);

  if (status === "hidden") {
    return null;
  }

  const isLeaving = status === "leaving";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Preparing Cradle Wellness Living"
      className={cn(
        "cradle-mobile-preloader-overlay fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-7 text-[#FCFAF5] transition-[opacity,transform] duration-[420ms] ease-out md:hidden",
        "bg-[#10261D]",
        isLeaving
          ? "pointer-events-none scale-[0.985] opacity-0"
          : "scale-100 opacity-100"
      )}
    >
      <span className="sr-only">Preparing your wellness experience</span>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(200,169,107,0.22),transparent_24%),radial-gradient(circle_at_18%_12%,rgba(30,77,58,0.7),transparent_36%),linear-gradient(180deg,rgba(16,38,29,0.84),rgba(8,22,16,0.98))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(ellipse_at_50%_100%,rgba(107,122,111,0.5),transparent_68%)]" />
      <Leaf aria-hidden="true" className="cradle-mobile-preloader-drift absolute -left-5 top-14 h-24 w-24 -rotate-12 text-[#9AA89A]/16" strokeWidth={1.1} />
      <Leaf aria-hidden="true" className="cradle-mobile-preloader-drift absolute -right-4 bottom-20 h-28 w-28 rotate-45 text-[#C8A96B]/14" strokeWidth={1.1} />

      <div className="relative flex w-full max-w-[330px] flex-col items-center text-center">
        <div className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-[#C8A96B]/70 bg-[#10261D]/55 shadow-[0_0_58px_rgba(200,169,107,0.26)] backdrop-blur-sm">
          <div className="absolute inset-3 rounded-full border border-[#E8D5A3]/18" />
          <Leaf aria-hidden="true" className="h-16 w-16 text-[#FCFAF5]" strokeWidth={1.35} />
          <Sparkles aria-hidden="true" className="absolute right-7 top-7 h-5 w-5 text-[#C8A96B]" strokeWidth={1.8} />
        </div>

        <p className="font-[family:var(--font-playfair)] text-[3.85rem] font-medium uppercase leading-none tracking-[0.24em] text-[#FCFAF5] drop-shadow-[0_4px_18px_rgba(0,0,0,0.32)]">
          Cradle
        </p>
        <p className="mt-3 text-[0.74rem] font-semibold uppercase tracking-[0.55em] text-[#C8A96B]">
          Wellness Living
        </p>

        <div className="my-9 flex w-48 items-center justify-center gap-4 text-[#C8A96B]">
          <span className="h-px flex-1 bg-[#C8A96B]/58" />
          <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.7} />
          <span className="h-px flex-1 bg-[#C8A96B]/58" />
        </div>

        <p className="font-[family:var(--font-playfair)] text-[2.6rem] font-semibold leading-tight text-[#FCFAF5]">
          Where calm begins.
        </p>
        <p className="mt-5 text-base leading-7 text-[#EDE4D3]">
          Preparing your wellness experience
        </p>

        <div className="mt-10 flex items-center justify-center gap-6">
          <span className="cradle-mobile-preloader-dot h-5 w-5 rounded-full bg-[#FCFAF5] shadow-[0_0_20px_rgba(252,250,245,0.28)]" />
          <span className="cradle-mobile-preloader-dot h-6 w-6 rounded-full bg-[#C8A96B] shadow-[0_0_24px_rgba(200,169,107,0.42)] [animation-delay:140ms]" />
          <span className="cradle-mobile-preloader-dot h-5 w-5 rounded-full bg-[#9AA89A] shadow-[0_0_20px_rgba(154,168,154,0.26)] [animation-delay:280ms]" />
        </div>
      </div>

      <style>{`
        @keyframes cradle-mobile-preloader-dot { 0%, 100% { transform: translateY(0); opacity: 0.72; } 50% { transform: translateY(-8px); opacity: 1; } }
        @keyframes cradle-mobile-preloader-drift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .cradle-mobile-preloader-dot { animation: cradle-mobile-preloader-dot 940ms ease-in-out infinite; }
        .cradle-mobile-preloader-drift { animation: cradle-mobile-preloader-drift 3.6s ease-in-out infinite; }
        @media (max-width: 767px) {
          html[data-mobile-preloader="active"] .sp-public .sp-reveal,
          html[data-mobile-preloader="active"] .sp-public .sp-reveal-scale,
          html[data-mobile-preloader="active"] .sp-public [data-hero-animation] {
            animation-play-state: paused;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cradle-mobile-preloader-dot,
          .cradle-mobile-preloader-drift {
            animation: none;
          }

          .cradle-mobile-preloader-overlay {
            transition-duration: 120ms;
          }
        }
      `}</style>
    </div>
  );
}
