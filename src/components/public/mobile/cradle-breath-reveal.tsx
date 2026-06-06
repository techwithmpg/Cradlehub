"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  PUBLIC_INTRO_EVENT,
  type PublicIntroEventDetail,
} from "@/components/public/public-loading-events";

const STORAGE_KEY = "cradle_public_intro_seen";
const INTRO_DURATION_MS = 1200;

type RevealState = "checking" | "showing" | "hidden";

function emitIntroState(isActive: boolean) {
  window.dispatchEvent(
    new CustomEvent<PublicIntroEventDetail>(PUBLIC_INTRO_EVENT, {
      detail: { isActive },
    })
  );
}

export function CradleBreathReveal() {
  const [revealState, setRevealState] = useState<RevealState>("checking");

  useEffect(() => {
    const hideOnNextTask = () => {
      const timeoutId = window.setTimeout(() => setRevealState("hidden"), 0);
      return () => window.clearTimeout(timeoutId);
    };

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let revealSeen = false;
    try {
      revealSeen = window.sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      revealSeen = true;
    }

    if (isDesktop || prefersReduced || revealSeen) {
      return hideOnNextTask();
    }

    let introStarted = false;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      return hideOnNextTask();
    }

    const showTimeoutId = window.setTimeout(() => {
      introStarted = true;
      emitIntroState(true);
      setRevealState("showing");
    }, 0);
    const hideTimeoutId = window.setTimeout(() => {
      emitIntroState(false);
      setRevealState("hidden");
    }, INTRO_DURATION_MS);

    return () => {
      window.clearTimeout(showTimeoutId);
      window.clearTimeout(hideTimeoutId);
      if (introStarted) {
        emitIntroState(false);
      }
    };
  }, []);

  if (revealState !== "showing") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="cradle-breath-reveal pointer-events-none fixed inset-0 z-[80] md:hidden"
    >
      <div className="absolute inset-0 bg-[#061912]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(200,169,106,0.28)_0%,rgba(200,169,106,0.10)_32%,rgba(6,25,18,0)_62%)]" />
      <div className="absolute inset-x-8 bottom-12 top-14 rounded-[32px] border border-[#C8A96A]/20 opacity-55" />
      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center text-[#F3E9D2]">
        <div className="cradle-breath-logo">
          <BrandLogo mode="mark" variant="dark" className="w-20 opacity-95" />
        </div>
        <div className="relative mt-8 h-8 w-full text-[23px] italic leading-8 [font-family:var(--sp-font-accent)]">
          <span className="cradle-breath-copy cradle-breath-copy-one">
            Breathe in...
          </span>
          <span className="cradle-breath-copy cradle-breath-copy-two">
            Welcome to Cradle
          </span>
          <span className="cradle-breath-copy cradle-breath-copy-three">
            Your calm is ready.
          </span>
        </div>
      </div>
    </div>
  );
}
