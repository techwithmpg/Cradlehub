"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { usePathname } from "next/navigation";
import {
  PUBLIC_INTRO_EVENT,
  type PublicIntroEventDetail,
} from "@/components/public/public-loading-events";

const PUBLIC_ROUTE_PATHS = new Set([
  "/",
  "/services",
  "/book",
  "/branches",
  "/about",
  "/contact",
]);

const MIN_VISIBLE_MS = 240;
const COMPLETE_VISIBLE_MS = 180;
const FALLBACK_TIMEOUT_MS = 4000;

type RouteLoadingPhase = "idle" | "loading" | "complete";
type TimerRef = MutableRefObject<number | null>;

function normalizePathname(pathname: string) {
  const trimmedPathname = pathname.replace(/\/+$/, "");
  return trimmedPathname.length > 0 ? trimmedPathname : "/";
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PATHS.has(normalizePathname(pathname));
}

function isModifiedClick(event: MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function getClickedAnchor(event: MouseEvent) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  return event.target.closest<HTMLAnchorElement>("a[href]");
}

function isIntroEvent(event: Event): event is CustomEvent<PublicIntroEventDetail> {
  return (
    event instanceof CustomEvent &&
    typeof event.detail === "object" &&
    event.detail !== null &&
    "isActive" in event.detail &&
    typeof event.detail.isActive === "boolean"
  );
}

export function PublicRouteLoadingLine() {
  const pathname = usePathname();
  const [phase, setPhaseState] = useState<RouteLoadingPhase>("idle");
  const phaseRef = useRef<RouteLoadingPhase>("idle");
  const startedAtRef = useRef<number | null>(null);
  const introActiveRef = useRef(false);
  const completeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const setPhase = useCallback((nextPhase: RouteLoadingPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const clearTimer = useCallback((timerRef: TimerRef) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideLine = useCallback(() => {
    startedAtRef.current = null;
    setPhase("idle");
  }, [setPhase]);

  const completeLoading = useCallback(() => {
    setPhase("complete");
    clearTimer(hideTimerRef);
    hideTimerRef.current = window.setTimeout(hideLine, COMPLETE_VISIBLE_MS);
  }, [clearTimer, hideLine, setPhase]);

  const finishLoading = useCallback(() => {
    if (phaseRef.current === "idle") {
      return;
    }

    clearTimer(fallbackTimerRef);
    clearTimer(completeTimerRef);

    const elapsed = startedAtRef.current
      ? Date.now() - startedAtRef.current
      : MIN_VISIBLE_MS;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);

    completeTimerRef.current = window.setTimeout(completeLoading, remaining);
  }, [clearTimer, completeLoading]);

  const startLoading = useCallback(() => {
    clearTimer(completeTimerRef);
    clearTimer(hideTimerRef);
    clearTimer(fallbackTimerRef);

    startedAtRef.current = Date.now();
    setPhase("loading");
    fallbackTimerRef.current = window.setTimeout(
      finishLoading,
      FALLBACK_TIMEOUT_MS
    );
  }, [clearTimer, finishLoading, setPhase]);

  useEffect(() => {
    function handleIntroState(event: Event) {
      if (isIntroEvent(event)) {
        introActiveRef.current = event.detail.isActive;
      }
    }

    window.addEventListener(PUBLIC_INTRO_EVENT, handleIntroState);
    return () => window.removeEventListener(PUBLIC_INTRO_EVENT, handleIntroState);
  }, []);

  useEffect(() => {
    const finishTimeoutId = window.setTimeout(finishLoading, 0);
    return () => window.clearTimeout(finishTimeoutId);
  }, [pathname, finishLoading]);

  useEffect(() => {
    if (!isPublicRoute(pathname)) {
      return undefined;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event) || introActiveRef.current) {
        return;
      }

      const anchor = getClickedAnchor(event);
      if (!anchor || anchor.hasAttribute("download")) {
        return;
      }

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      const currentPathname = normalizePathname(window.location.pathname);
      const targetPathname = normalizePathname(targetUrl.pathname);

      if (
        !PUBLIC_ROUTE_PATHS.has(currentPathname) ||
        !PUBLIC_ROUTE_PATHS.has(targetPathname) ||
        currentPathname === targetPathname
      ) {
        return;
      }

      startLoading();
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [pathname, startLoading]);

  useEffect(() => {
    return () => {
      clearTimer(completeTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(fallbackTimerRef);
    };
  }, [clearTimer]);

  if (phase === "idle") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="public-route-loading-track pointer-events-none fixed inset-x-0 z-[70] h-[3px] overflow-hidden md:hidden"
    >
      <div className="public-route-loading-line" data-phase={phase} />
    </div>
  );
}
