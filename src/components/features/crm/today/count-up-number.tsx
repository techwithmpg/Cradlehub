"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUpNumber({
  value,
  duration = 600,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const delta = value - startValue;
    if (delta === 0) return;

    if (!hasMountedRef.current || prefersReducedMotion()) {
      prevValueRef.current = value;
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${value.toLocaleString()}${suffix}`;
      }
      return;
    }

    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(startValue + delta * eased);
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
      }
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevValueRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, prefix, suffix]);

  return (
    <span ref={spanRef} className={className}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
