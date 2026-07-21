"use client";

import { useEffect, useRef } from "react";
import {
  BOOKING_NOTIFICATION_EVENT,
  isNotificationSoundEnabled,
} from "./notification-sound-preference";

const PLAYED_KEY = "cradlehub_sound_session_ids";

function readPlayedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(PLAYED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writePlayedIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(PLAYED_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {}
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

  // Realtime dispatches this event only for a fresh, visible booking alert.
  // Existing unread rows are never replayed on mount.
  useEffect(() => {
    const handleBookingNotification = (event: Event) => {
      const notificationId = (event as CustomEvent<{ notificationId?: unknown }>).detail
        ?.notificationId;
      if (typeof notificationId !== "string") return;

      const played = readPlayedIds();
      if (played.has(notificationId)) return;
      played.add(notificationId);
      writePlayedIds(played);

      if (
        isNotificationSoundEnabled() &&
        readyRef.current &&
        ctxRef.current?.state === "running"
      ) {
        playChime(ctxRef.current);
      }
    };

    window.addEventListener(BOOKING_NOTIFICATION_EVENT, handleBookingNotification);
    return () => {
      window.removeEventListener(BOOKING_NOTIFICATION_EVENT, handleBookingNotification);
    };
  }, []);

  return null;
}
