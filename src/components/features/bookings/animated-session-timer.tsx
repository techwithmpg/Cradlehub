"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSessionTimerDisplay,
  type SessionTimerInput,
} from "@/lib/bookings/animated-session-timer";
import styles from "./animated-session-timer.module.css";

export function AnimatedSessionTimer({ session }: { session: SessionTimerInput }) {
  const root = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState<{ now: number; paused: boolean } | null>(null);
  const ticking = getSessionTimerDisplay(session, 0).active;
  useEffect(() => {
    let inView = true;
    let interval: number | undefined;
    const sync = () => {
      const paused = document.hidden || !inView || !ticking;
      setClock({ now: Date.now(), paused });
      window.clearInterval(interval);
      if (!paused)
        interval = window.setInterval(() => setClock({ now: Date.now(), paused: false }), 1000);
    };
    const initial = window.setTimeout(sync, 0);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false;
            sync();
          })
        : null;
    if (root.current) observer?.observe(root.current);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [ticking, session.session_started_at, session.session_due_at]);
  const display = getSessionTimerDisplay(
    session,
    clock?.now ?? (Date.parse(session.session_started_at ?? "") || 0)
  );
  const value =
    display.phase === "completed"
      ? "Done"
      : display.phase === "closed"
        ? "Closed"
        : display.active && !clock
          ? "—"
          : `${display.phase === "overtime" ? "+" : ""}${display.minutes}m`;
  const label =
    display.phase === "completed"
      ? "completed"
      : display.phase === "closed"
        ? "not active"
        : display.phase === "scheduled"
          ? "not started"
          : display.phase === "overtime"
            ? "over"
            : "left";
  return (
    <div
      ref={root}
      className={styles.timer}
      data-phase={display.phase}
      data-paused={clock?.paused ?? true}
      role="timer"
      aria-live="off"
      aria-label={`${value} ${label}`}
    >
      <span className={styles.glow} aria-hidden="true" />
      <svg viewBox="0 0 120 120" className={styles.ring} aria-hidden="true">
        <circle cx="60" cy="60" r="51" fill="none" stroke="#e2ebe5" strokeWidth="8" />
        <circle
          className={styles.stroke}
          cx="60"
          cy="60"
          r="51"
          pathLength="100"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="100"
          strokeDashoffset={
            display.phase === "scheduled" || display.phase === "closed" ? 0 : -display.progress
          }
        />
      </svg>
      <div className={styles.center}>
        <span key={value} className={styles.number}>
          {value}
        </span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
