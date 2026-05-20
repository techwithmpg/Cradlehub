"use client";

import { useEffect, useRef } from "react";
import { getUnreadBookingNotificationIdsAction } from "@/lib/notifications/queries";

const PLAYED_KEY    = "cradlehub_sound_played_ids";
const ENABLED_KEY   = "cradlehub_notification_sound_enabled";
const POLL_INTERVAL = 60_000;

function readPlayedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PLAYED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writePlayedIds(ids: Set<string>): void {
  try {
    // Keep last 200 to prevent unbounded localStorage growth.
    localStorage.setItem(PLAYED_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {}
}

function isEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    return v === null || v === "true"; // default on
  } catch {
    return true;
  }
}

// Soft two-tone chime (A5 → C6) at low volume, ~0.5s total.
function playChime(ctx: AudioContext): void {
  const t = ctx.currentTime;
  [880, 1046].forEach((freq, i) => {
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const s = t + i * 0.18;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.1, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
      osc.start(s);
      osc.stop(s + 0.3);
    } catch {}
  });
}

export function BookingNotificationSound() {
  const ctxRef   = useRef<AudioContext | null>(null);
  const readyRef = useRef(false); // true once AudioContext is running

  // Unlock AudioContext on first user gesture (browser autoplay policy).
  useEffect(() => {
    function unlock() {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext();
        }
        if (ctxRef.current.state === "suspended") {
          ctxRef.current.resume().then(() => {
            readyRef.current = true;
          }).catch(() => {});
        } else if (ctxRef.current.state === "running") {
          readyRef.current = true;
        }
      } catch {}
    }
    document.addEventListener("click",   unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("click",   unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  // On mount: silently mark all currently-unread booking IDs as "already seen"
  // so we never chime for notifications that existed before this session.
  useEffect(() => {
    getUnreadBookingNotificationIdsAction().then((ids) => {
      if (ids.length === 0) return;
      const played = readPlayedIds();
      ids.forEach((id) => played.add(id));
      writePlayedIds(played);
    }).catch(() => {});
  }, []);

  // Poll every 60s for IDs not yet played; chime once if any are new.
  // Polling pauses while the tab is hidden to avoid unnecessary backend reads.
  useEffect(() => {
    const poll = async () => {
      if (!isEnabled()) return;
      try {
        const ids    = await getUnreadBookingNotificationIdsAction();
        const played = readPlayedIds();
        const newIds = ids.filter((id) => !played.has(id));
        if (newIds.length === 0) return;
        if (readyRef.current && ctxRef.current) {
          playChime(ctxRef.current);
          newIds.forEach((id) => played.add(id));
          writePlayedIds(played);
        }
        // If AudioContext not yet unlocked, leave IDs unmarked so we retry next poll.
      } catch {}
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { timer = setInterval(poll, POLL_INTERVAL); };
    const stop  = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
    const handleVisibility = () => { if (document.hidden) { stop(); } else { poll(); start(); } };
    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVisibility); };
  }, []);

  return null;
}
