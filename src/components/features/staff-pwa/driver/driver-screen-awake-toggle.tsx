"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Opt-in foreground Screen Wake Lock. Never claims to run after screen-off. */
export function DriverScreenAwakeToggle() {
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback(async () => {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      const granted = await navigator.wakeLock.request("screen");
      sentinel.current = granted;
      setActive(true);
      setError(null);
      granted.addEventListener("release", () => {
        if (sentinel.current === granted) sentinel.current = null;
        setActive(false);
      });
    } catch {
      setActive(false);
      setError("This device cannot keep the screen awake right now.");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinel.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, acquire]);

  useEffect(() => () => {
    if (sentinel.current) void sentinel.current.release();
  }, []);

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  if (!supported) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d2e0d3] bg-white p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#163a2b]">Keep screen awake during navigation</p>
        <p className="text-[11px] text-[#66776d]">
          {active ? "On while the PWA stays visible" : enabled ? "Temporarily unavailable" : "Off · conserves battery"}
        </p>
      </div>
      <button type="button" aria-pressed={enabled}
        onClick={() => {
          if (enabled) {
            setEnabled(false);
            setActive(false);
            if (sentinel.current) void sentinel.current.release();
            sentinel.current = null;
          } else {
            setEnabled(true);
            void acquire();
          }
        }}
        className="min-h-10 rounded-lg border border-[#b8cabb] px-4 text-xs font-semibold text-[#163a2b]">
        {enabled ? "Disable" : "Enable"}
      </button>
      {error ? <p role="status" className="w-full text-xs text-amber-800">{error}</p> : null}
    </div>
  );
}
