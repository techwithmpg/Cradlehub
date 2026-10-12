"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export type SafeSnapshot = {
  screen: "today" | "schedule" | "progress";
  label: string;
  counts: readonly { label: string; value: number }[];
  updatedAt: number;
};

type CacheValue = {
  read: (screen: SafeSnapshot["screen"]) => SafeSnapshot | null;
  write: (snapshot: Omit<SafeSnapshot, "updatedAt">) => void;
  invalidate: (screens: readonly SafeSnapshot["screen"][]) => void;
  readPreference: (key: "scheduleDate" | "progressTab") => string | null;
  writePreference: (key: "scheduleDate" | "progressTab", value: string) => void;
};

const Context = createContext<CacheValue | null>(null);
const MAX_AGE_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 1000;

/** Only non-sensitive counts and labels live in this provider. It unmounts on logout. */
export function StaffSafeMemoryProvider({
  identity,
  children,
}: {
  identity: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState<{
    identity: string;
    snapshots: Partial<Record<SafeSnapshot["screen"], SafeSnapshot>>;
    preferences: Partial<Record<"scheduleDate" | "progressTab", string>>;
  }>({ identity, snapshots: {}, preferences: {} });
  const read = useCallback(
    (screen: SafeSnapshot["screen"]) => {
      const snapshot = entry.identity === identity ? entry.snapshots[screen] : null;
      return snapshot && Date.now() - snapshot.updatedAt < MAX_AGE_MS ? snapshot : null;
    },
    [entry, identity]
  );

  const write = useCallback(
    (snapshot: Omit<SafeSnapshot, "updatedAt">) => {
      setEntry((previous) => ({
        identity,
        preferences: previous.identity === identity ? previous.preferences : {},
        snapshots: {
          ...(previous.identity === identity ? previous.snapshots : {}),
          [snapshot.screen]: {
            screen: snapshot.screen,
            label: snapshot.label.slice(0, 64),
            counts: snapshot.counts.slice(0, 4).map(({ label, value }) => ({
              label: label.slice(0, 32),
              value: Number.isFinite(value) ? value : 0,
            })),
            updatedAt: Date.now(),
          },
        },
      }));
    },
    [identity]
  );

  const invalidate = useCallback(
    (screens: readonly SafeSnapshot["screen"][]) => {
      setEntry((previous) => {
        if (previous.identity !== identity) return { identity, snapshots: {}, preferences: {} };
        const snapshots = { ...previous.snapshots };
        for (const screen of screens) delete snapshots[screen];
        return { identity, snapshots, preferences: previous.preferences };
      });
    },
    [identity]
  );

  const readPreference = useCallback(
    (key: "scheduleDate" | "progressTab") =>
      entry.identity === identity ? (entry.preferences[key] ?? null) : null,
    [entry, identity]
  );
  const writePreference = useCallback(
    (key: "scheduleDate" | "progressTab", value: string) => {
      setEntry((previous) => ({
        identity,
        snapshots: previous.identity === identity ? previous.snapshots : {},
        preferences: {
          ...(previous.identity === identity ? previous.preferences : {}),
          [key]: value.slice(0, 32),
        },
      }));
    },
    [identity]
  );

  useEffect(() => {
    const onInvalidate = (event: Event) => {
      const screens = (event as CustomEvent<SafeSnapshot["screen"][]>).detail;
      if (Array.isArray(screens)) invalidate(screens);
    };
    window.addEventListener("staff-pwa:invalidate", onInvalidate);
    return () => window.removeEventListener("staff-pwa:invalidate", onInvalidate);
  }, [invalidate]);

  useEffect(() => {
    let lastRefresh = Date.now();
    const refreshIfStale = () => {
      if (Date.now() - lastRefresh < STALE_MS || !navigator.onLine) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    window.addEventListener("online", refreshIfStale);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", refreshIfStale);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  const value = useMemo(
    () => ({ read, write, invalidate, readPreference, writePreference }),
    [read, write, invalidate, readPreference, writePreference]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStaffSafeMemory() {
  return useContext(Context);
}

export function StaffSnapshotRecorder({ snapshot }: { snapshot: Omit<SafeSnapshot, "updatedAt"> }) {
  const cache = useStaffSafeMemory();
  const write = cache?.write;
  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    write?.(JSON.parse(serialized) as Omit<SafeSnapshot, "updatedAt">);
  }, [write, serialized]);
  return null;
}

export function invalidateStaffSafeMemory(screens: SafeSnapshot["screen"][]) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("staff-pwa:invalidate", { detail: screens }));
}
