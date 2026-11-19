"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Expand, MonitorUp, RefreshCw, Radio } from "lucide-react";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import type { LiveBoardData } from "@/lib/cradle-live/types";
import { People, Rooms, Treatments, Alerts, Finance, Lifecycle } from "./board-panels";
import { Dispatch } from "./board-dispatch";
import s from "./cradle-live-board.module.css";

const timeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function CradleLiveBoard({
  initial,
  children,
}: {
  initial: LiveBoardData;
  children?: ReactNode;
}) {
  const router = useRouter(),
    rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.parse(initial.refreshedAt));
  const [expanded, setExpanded] = useState(false),
    [windowError, setWindowError] = useState<string | null>(null);
  const [online, setOnline] = useState(true),
    [timeoutAt, setTimeoutAt] = useState(0);
  const pending = useRef<number | null>(null),
    queued = useRef(false);
  const fixture = initial.scenario === "fixture";
  const refresh = useCallback(() => {
    if (fixture || document.hidden || !navigator.onLine) return;
    if (pending.current !== null) {
      queued.current = true;
      return;
    }
    pending.current = window.setTimeout(() => {
      pending.current = null;
      setTimeoutAt(Date.now());
    }, 15000);
    router.refresh();
  }, [router, fixture]);
  useEffect(() => {
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    if (queued.current) {
      queued.current = false;
      refresh();
    }
  }, [initial.refreshedAt, refresh]);
  useEffect(() => {
    const onFull = () => setExpanded(Boolean(document.fullscreenElement));
    const onNet = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    const onVisible = () => {
      if (!document.hidden) {
        if (!fixture) setNow(Date.now());
        refresh();
      }
    };
    const initialNetwork = window.setTimeout(() => setOnline(navigator.onLine), 0);
    const tick = window.setInterval(() => {
      if (!document.hidden && !fixture) setNow(Date.now());
    }, 1000);
    const poll = window.setInterval(refresh, 60000);
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      clearTimeout(initialNetwork);
      clearInterval(tick);
      clearInterval(poll);
      if (pending.current !== null) {
        clearTimeout(pending.current);
        pending.current = null;
      }
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, [refresh, fixture]);
  const snapshot = Date.parse(initial.refreshedAt),
    age = Math.max(0, Math.floor((now - snapshot) / 60000));
  const stale =
    !online ||
    timeoutAt > snapshot ||
    now - snapshot > 150000 ||
    initial.errors.length > 0 ||
    initial.issues === null;
  async function toggleFullScreen() {
    setWindowError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setWindowError("Fullscreen was blocked by the browser. Try F11.");
    }
  }
  // Popup created synchronously within the click handler to avoid popup blockers.
  // Window-management positioning is best-effort and always permission-gated.
  async function openExternal() {
    setWindowError(null);
    const popup = window.open(
      window.location.href,
      "cradle-live-secondary",
      "popup=yes,width=1500,height=900"
    );
    if (!popup) {
      setWindowError("Popup blocked. Allow popups, then retry.");
      return;
    }
    type Detailed = {
      isPrimary: boolean;
      availLeft: number;
      availTop: number;
      availWidth: number;
      availHeight: number;
    };
    const w = window as Window & { getScreenDetails?: () => Promise<{ screens: Detailed[] }> };
    if (!w.getScreenDetails) {
      setWindowError("Move the new window to the extended monitor, then select Fullscreen.");
      return;
    }
    try {
      const details = await w.getScreenDetails();
      const external = details.screens.find((screen) => !screen.isPrimary);
      if (!external) {
        setWindowError("No extended monitor detected. The wallboard opened in a separate window.");
        return;
      }
      popup.moveTo(external.availLeft, external.availTop);
      popup.resizeTo(external.availWidth, external.availHeight);
      popup.focus();
      setWindowError("Wallboard window opened. Select Fullscreen there to fill the monitor.");
    } catch {
      setWindowError(
        "Display permission was unavailable. Move the new window manually, then select Fullscreen."
      );
    }
  }

  return (
    <div ref={rootRef} className={s.wallboard}>
      <header className={s.header}>
        <div className={s.brand}>
          <b>C</b>
          <div>
            <h1>
              Cradle Live <em>2.0</em>
            </h1>
            <small>Cradle Wellness Living</small>
          </div>
        </div>
        <div className={s.branches}>{children ?? <span>{initial.branch}</span>}</div>
        <div className={s.headerAlerts}>
          {initial.issues ? (
            <>
              <b>{initial.issues.filter((i) => i.severity === "critical").length} critical</b>{" "}
              {initial.issues.filter((i) => i.severity === "warning").length} warning
            </>
          ) : (
            "Issues unavailable"
          )}
        </div>
        <div className={s.health} data-live={!fixture && !stale}>
          <Radio size={14} />
          <div>
            {fixture ? "Sample feed" : stale ? "Needs verification" : "Live"} ·{" "}
            {fixture ? "10 AM scenario" : age + " min ago"}
          </div>
        </div>
        <div className={s.clock}>
          <b>{timeFormat.format(now)}</b>
          <small>{dateFormat.format(now)} · PH</small>
        </div>
        <div className={s.tools}>
          {!fixture && (
            <button onClick={refresh} aria-label="Refresh dashboard" title="Refresh dashboard">
              <RefreshCw size={16} />
            </button>
          )}
          <button onClick={openExternal} aria-label="Extended screen" title="Extended screen">
            <MonitorUp size={16} />
          </button>
          <button
            onClick={toggleFullScreen}
            aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
            title="Fullscreen"
          >
            <Expand size={18} />
          </button>
        </div>
      </header>
      {windowError && (
        <div className={s.notice} role="status">
          {windowError}
        </div>
      )}
      {initial.errors.length > 0 && (
        <div className={s.notice} role="alert">
          {initial.errors.join(" · ")}
        </div>
      )}
      <div className={s.main}>
        <div className={s.operations}>
          <div className={s.people}>
            <People data={initial} />
          </div>
          <div className={s.center}>
            <Dispatch data={initial} now={now} />
            <Rooms data={initial} />
          </div>
          <div className={s.right}>
            <Treatments rows={initial.bookings} now={now} />
            <Alerts data={initial} />
          </div>
        </div>
        <div className={s.bottom}>
          <Lifecycle data={initial} now={now} />
          <Finance data={initial} />
        </div>
      </div>
    </div>
  );
}
