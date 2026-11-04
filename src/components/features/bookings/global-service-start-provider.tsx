"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getCrmServiceStartSnapshotAction } from "@/app/(dashboard)/crm/service-start-actions";
import { crmStartServiceAction, markBookingArrivedAction, recordBookingFollowupAction } from "@/app/(dashboard)/crm/bookings/actions";
import { BOOKINGS_CHANGED_EVENT, notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { serviceTransitionEventId } from "@/lib/bookings/service-transition-event";
import type { ServiceStartReminder } from "@/lib/bookings/service-start-reminders";
import { ServiceStartActionDialog } from "./service-start-action-dialog";

const POLL_MS = 30_000;
type GlobalServiceStartContextValue = {
  queue: ServiceStartReminder[];
  openAction: (bookingId: string) => void;
};
const GlobalServiceStartContext = createContext<GlobalServiceStartContextValue | null>(null);

export function useGlobalServiceStartActions(): GlobalServiceStartContextValue | null {
  return useContext(GlobalServiceStartContext);
}

function isAnotherCriticalDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

function isEditing(): boolean {
  const element = document.activeElement;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    || Boolean(element instanceof HTMLElement && element.isContentEditable);
}

function dismissalKey(branchId: string, action: ServiceStartReminder): string {
  return `service-start-dismissed:${branchId}:${action.bookingId}:${action.scheduledAtIso}`;
}

function formatStartedAt(timestamp: string | undefined): string | null {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
    .format(new Date(timestamp));
}

export function GlobalServiceStartProvider({ children, branchId }: { children: ReactNode; branchId: string }) {
  const [queue, setQueue] = useState<ServiceStartReminder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState({ now: 0, offset: 0 });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.hidden) return;
    inFlight.current = true;
    try {
      const snapshot = await getCrmServiceStartSnapshotAction();
      if (!snapshot.ok) return;
      const offset = Date.parse(snapshot.serverNow) - Date.now();
      setClock({ now: Date.now(), offset });
      setQueue(snapshot.actions);
      setActiveId((current) => {
        if (current) return snapshot.actions.some((entry) => entry.bookingId === current) ? current : null;
        if (isAnotherCriticalDialogOpen() || isEditing()) return null;
        return snapshot.actions.find((entry) => !window.sessionStorage.getItem(dismissalKey(branchId, entry)))?.bookingId ?? null;
      });
    } catch {
      // Keep outstanding actions visible through transient connection failures.
    } finally {
      inFlight.current = false;
    }
  }, [branchId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(BOOKINGS_CHANGED_EVENT, onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => setClock((current) => ({ ...current, now: Date.now() })), 1000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  const active = useMemo(() => queue.find((entry) => entry.bookingId === activeId) ?? null, [queue, activeId]);
  const dueMinutes = active
    ? Math.ceil((Date.parse(active.scheduledAtIso) - clock.now - clock.offset) / 60_000)
    : 0;
  const dueLabel = dueMinutes >= 0 ? `Due in ${dueMinutes} min` : `Overdue ${Math.abs(dueMinutes)} min`;

  function dismiss() {
    if (active) window.sessionStorage.setItem(dismissalKey(branchId, active), "1");
    setActiveId(null);
  }

  async function handleStart() {
    if (!active || busy) return;
    setBusy(true);
    try {
      const result = await crmStartServiceAction({ bookingId: active.bookingId });
      if (!result.success) {
        toast.error(result.error || "Service could not be started.");
        return;
      }
      if (!result.alreadyStarted) {
        toast.success("Service Started", {
          ...(result.startedAt ? { id: serviceTransitionEventId("started", active.bookingId, result.startedAt) } : {}),
          description: `${active.recipientName} — ${active.serviceName}${formatStartedAt(result.startedAt) ? ` · Started at ${formatStartedAt(result.startedAt)}` : ""}`,
        });
      }
      setQueue((current) => current.filter((entry) => entry.bookingId !== active.bookingId));
      setActiveId(null);
      notifyBookingsChanged();
      void refresh();
    } catch {
      toast.error("Service could not be started.");
    } finally { setBusy(false); }
  }

  async function handleArrived() {
    if (!active || busy) return;
    setBusy(true);
    try {
      const result = await markBookingArrivedAction({ bookingId: active.bookingId });
      if (!result.success) { toast.error(result.error || "Arrival could not be recorded."); return; }
      toast.success("Customer marked arrived and waiting.");
      dismiss();
      notifyBookingsChanged();
      void refresh();
    } catch { toast.error("Arrival could not be recorded."); }
    finally { setBusy(false); }
  }

  async function handleNotArrived() {
    if (!active || busy) return;
    setBusy(true);
    try {
      const result = await recordBookingFollowupAction({
        bookingId: active.bookingId,
        result: "not_arrived",
        note: "Customer not yet arrived for scheduled service.",
      });
      if (!result.success) { toast.error(result.error || "Absence could not be recorded."); return; }
      toast.success("Absence recorded. Booking remains active for follow-up.");
      dismiss();
      notifyBookingsChanged();
    } catch { toast.error("Absence could not be recorded."); }
    finally { setBusy(false); }
  }

  const contextValue = useMemo(() => ({ queue, openAction: setActiveId }), [queue]);
  return <GlobalServiceStartContext.Provider value={contextValue}>
    {children}
    {queue.length > 0 && !active && <button type="button" onClick={() => setActiveId(queue[0]!.bookingId)}
      className="fixed bottom-6 right-6 z-40 rounded-full border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
      Service Actions · {queue.length} due
    </button>}
    <ServiceStartActionDialog action={active} dueLabel={dueLabel} busy={busy}
      onClose={dismiss} onStart={() => void handleStart()} onArrived={() => void handleArrived()}
      onNotArrived={() => void handleNotArrived()} />
  </GlobalServiceStartContext.Provider>;
}
