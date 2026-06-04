"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

const MIN_VISIBLE_MS = 280;
const COMPLETE_VISIBLE_MS = 220;
const FALLBACK_TIMEOUT_MS = 3500;

type MobileNavigationPhase = "idle" | "loading" | "complete";

type MobileNavigationProgressContextValue = {
  isNavigating: boolean;
  phase: MobileNavigationPhase;
  startNavigation: () => void;
  stopNavigation: () => void;
};

const noopContextValue: MobileNavigationProgressContextValue = {
  isNavigating: false,
  phase: "idle",
  startNavigation: () => undefined,
  stopNavigation: () => undefined,
};

const MobileNavigationProgressContext =
  createContext<MobileNavigationProgressContextValue | null>(null);

function clearTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

type MobileNavigationProgressProviderProps = {
  children: ReactNode;
};

export function MobileNavigationProgressProvider({
  children,
}: MobileNavigationProgressProviderProps) {
  const [phase, setPhaseState] = useState<MobileNavigationPhase>("idle");
  const phaseRef = useRef<MobileNavigationPhase>("idle");
  const startedAtRef = useRef<number | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((nextPhase: MobileNavigationPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const finishNavigation = useCallback(() => {
    setPhase("complete");
    clearTimer(hideTimerRef);
    hideTimerRef.current = setTimeout(() => {
      startedAtRef.current = null;
      setPhase("idle");
    }, COMPLETE_VISIBLE_MS);
  }, [setPhase]);

  const stopNavigation = useCallback(() => {
    if (phaseRef.current === "idle") {
      return;
    }

    clearTimer(fallbackTimerRef);
    clearTimer(completeTimerRef);

    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : MIN_VISIBLE_MS;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);

    completeTimerRef.current = setTimeout(finishNavigation, remaining);
  }, [finishNavigation]);

  const startNavigation = useCallback(() => {
    clearTimer(completeTimerRef);
    clearTimer(hideTimerRef);
    clearTimer(fallbackTimerRef);

    startedAtRef.current = Date.now();
    setPhase("loading");
    fallbackTimerRef.current = setTimeout(stopNavigation, FALLBACK_TIMEOUT_MS);
  }, [setPhase, stopNavigation]);

  useEffect(() => {
    return () => {
      clearTimer(completeTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(fallbackTimerRef);
    };
  }, []);

  const value = useMemo<MobileNavigationProgressContextValue>(
    () => ({
      isNavigating: phase !== "idle",
      phase,
      startNavigation,
      stopNavigation,
    }),
    [phase, startNavigation, stopNavigation]
  );

  return (
    <MobileNavigationProgressContext.Provider value={value}>
      {children}
    </MobileNavigationProgressContext.Provider>
  );
}

export function useMobileNavigationProgress() {
  return useContext(MobileNavigationProgressContext) ?? noopContextValue;
}
