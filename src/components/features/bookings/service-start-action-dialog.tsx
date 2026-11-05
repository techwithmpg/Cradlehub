"use client";

import { CalendarDays, Clock3, DoorOpen, Play, UserRound, UsersRound, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime12h } from "@/lib/utils/time-format";
import type { ServiceStartReminder } from "@/lib/bookings/service-start-reminders";

export type ServiceStartActionDetails = Omit<ServiceStartReminder, "scheduledAtIso">;

export function ServiceStartActionDialog({
  action, dueLabel, busy, onClose, onStart, onArrived, onNotArrived,
}: {
  action: ServiceStartActionDetails | null;
  dueLabel: string;
  busy: boolean;
  onClose: () => void;
  onStart: () => void;
  onArrived: () => void;
  onNotArrived: () => void;
}) {
  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent
        data-testid="service-start-action-dialog"
        className="w-[min(95vw,555px)] max-w-none gap-0 overflow-hidden rounded-[20px] border border-neutral-200 bg-white p-0 shadow-2xl"
      >
        <DialogHeader className="border-b border-neutral-200 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50 via-white to-neutral-50 px-4 py-3 pr-12">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
              <Clock3 className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold text-neutral-950">Action Required</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-neutral-700">{dueLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {action && (
          <>
            <div className="grid gap-4 border-b border-neutral-200 px-4 py-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-hidden="true">
                    <UserRound className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-neutral-950">{action.recipientName}</p>
                    <p className="truncate text-sm text-neutral-700">{action.serviceName} ({action.durationMinutes}m)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-3">
                  <UserRound className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600">Therapist</p>
                    <p className="truncate text-sm font-semibold text-neutral-950">{action.therapistName}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-1 sm:border-t-0 sm:border-l sm:py-0 sm:pl-5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="size-5 shrink-0 text-slate-600" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-slate-600">Scheduled Start</p>
                    <p className="text-sm font-bold text-neutral-950">{formatTime12h(action.scheduledStart)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DoorOpen className="size-5 shrink-0 text-slate-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600">Room</p>
                    <p className="truncate text-sm font-bold text-neutral-950">{action.roomName}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1.2fr_1.2fr_1fr]">
              <button
                type="button"
                disabled={busy}
                onClick={onStart}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
              >
                <Play className="size-4 shrink-0 fill-current" aria-hidden="true" />
                Start Service Now
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onArrived}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
              >
                <UsersRound className="size-5 shrink-0" aria-hidden="true" />
                <span className="text-center">Customer Arrived — Waiting</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onNotArrived}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50"
              >
                <UserX className="size-5 shrink-0 text-slate-600" aria-hidden="true" />
                <span className="text-center">Customer Not Arrived</span>
              </button>
            </div>
            {action.groupReference && (
              <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-600">
                Only this guest's service in group booking {action.groupReference} is affected.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
