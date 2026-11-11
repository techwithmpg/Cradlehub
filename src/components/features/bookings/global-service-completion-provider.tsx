"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCrmPaymentReadySnapshotAction,
  type CrmPaymentReadyItem,
} from "@/app/(dashboard)/crm/service-completion-actions";

const POLL_MS = 60_000;
const MIN_FOCUS_INTERVAL_MS = 45_000;
const INITIAL_DELAY_MS = 8_000;
const seenKey = (branchId: string, id: string) => `crm-payment-ready-dismissed:${branchId}:${id}`;
const notifiedKey = (branchId: string, id: string) => `crm-payment-ready-notified:${branchId}:${id}`;

export function GlobalServiceCompletionProvider({
  children,
  branchId,
}: {
  children: ReactNode;
  branchId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CrmPaymentReadyItem[]>([]);
  const [show, setShow] = useState(false);
  const inFlight = useRef(false);
  const lastFetchedAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    async function refresh(force = false) {
      if (document.hidden || inFlight.current) return;
      const now = Date.now();
      if (!force && now - lastFetchedAtRef.current < MIN_FOCUS_INTERVAL_MS) return;

      inFlight.current = true;
      lastFetchedAtRef.current = now;
      try {
        const snapshot = await getCrmPaymentReadySnapshotAction();
        if (!mounted || !snapshot.ok) return;

        let hasBrandNewCompletion = false;
        for (const item of snapshot.items) {
          const nKey = notifiedKey(branchId, item.notificationId);
          if (!sessionStorage.getItem(nKey)) {
            sessionStorage.setItem(nKey, "1");
            hasBrandNewCompletion = true;
          }
        }

        if (hasBrandNewCompletion) {
          notifyBookingsChanged();
        }

        const eligible = snapshot.items.filter(
          (item) => !sessionStorage.getItem(seenKey(branchId, item.notificationId))
        );
        setItems(eligible);
        const editing =
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement;
        const anotherModal = Boolean(
          document.querySelector('[role="dialog"][data-state="open"]')
        );
        if (eligible.length && !editing && !anotherModal) setShow(true);
        if (!eligible.length) setShow(false);
      } catch {
        // Preserve queued state during transient connectivity failures.
      } finally {
        inFlight.current = false;
      }
    }

    const initial = window.setTimeout(() => void refresh(true), INITIAL_DELAY_MS);
    const timer = window.setInterval(() => void refresh(true), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [branchId]);

  const active = items[0] ?? null;
  function dismiss() {
    if (active) sessionStorage.setItem(seenKey(branchId, active.notificationId), "1");
    setItems((previous) => previous.slice(1));
    setShow(false);
  }
  function openCheckout() {
    if (!active) return;
    const bookingId = active.bookingId;
    dismiss();
    router.push(`/crm/bookings?bookingId=${encodeURIComponent(bookingId)}`);
  }

  return (
    <>
      {children}
      {items.length > 0 && !show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Payments ready · {items.length}
        </button>
      ) : null}
      <Dialog
        open={show && Boolean(active)}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        <DialogContent
          data-testid="crm-service-completion-payment-modal"
          className="w-[min(94vw,490px)] rounded-2xl bg-white"
        >
          <DialogHeader>
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <DialogTitle>Service Completed — Ready for Payment</DialogTitle>
            <DialogDescription>
              {active?.automaticallyCompleted
                ? "The service reached its recorded completion time."
                : "The service was marked completed."}{" "}
              Please review the customer's balance and collect payment through the existing
              checkout.
            </DialogDescription>
          </DialogHeader>
          {active ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-neutral-950">{active.recipientName}</p>
              <p className="text-neutral-700">{active.serviceName}</p>
              <p className="mt-1 text-xs text-neutral-600">
                Completed{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  timeZone: "Asia/Manila",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(active.completedAt))}
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openCheckout}
              className="min-h-11 flex-1 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Open Booking / Checkout
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-800"
            >
              Later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
