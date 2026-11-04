"use client";

import { CalendarDays, Clock3, DoorOpen, Info, Play, UserPlus, UserRound, UserX, Zap } from "lucide-react";
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
  return <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="w-[min(94vw,700px)] max-w-none gap-0 overflow-hidden rounded-2xl p-0">
      <DialogHeader className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-violet-50 px-5 py-5 pr-14 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-100 text-indigo-900"><Zap className="size-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-neutral-950">Service Start — Action Required</DialogTitle>
            <DialogDescription className="sr-only">Choose how to handle this service start.</DialogDescription>
          </div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-indigo-900" role="status">{dueLabel}</span>
        </div>
      </DialogHeader>
      {action && <div className="space-y-4 p-5 sm:p-6">
        <dl className="grid gap-3 rounded-xl bg-neutral-50 p-4 text-sm sm:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex min-w-0 items-start gap-2"><UserRound className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden="true" />
            <div className="min-w-0"><dt className="sr-only">Service recipient</dt><dd className="truncate font-bold text-neutral-950">{action.recipientName}</dd><dd className="text-xs text-neutral-600">{action.serviceName} ({action.durationMinutes} min)</dd></div></div>
          <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden="true" />
            <div><dt className="text-xs text-neutral-600">Scheduled Start</dt><dd className="font-semibold text-neutral-950">{formatTime12h(action.scheduledStart)}</dd></div></div>
          <div className="flex min-w-0 items-start gap-2"><UserRound className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden="true" />
            <div className="min-w-0"><dt className="text-xs text-neutral-600">Therapist</dt><dd className="truncate font-semibold text-neutral-950">{action.therapistName}</dd></div></div>
          <div className="flex min-w-0 items-start gap-2"><DoorOpen className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden="true" />
            <div className="min-w-0"><dt className="text-xs text-neutral-600">Room</dt><dd className="truncate font-semibold text-neutral-950">{action.roomName}</dd></div></div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" disabled={busy} onClick={onStart} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-4 text-center shadow-sm transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
            <span className="grid size-9 place-items-center rounded-full bg-emerald-700 text-white"><Play className="size-5 fill-current" aria-hidden="true" /></span>
            <span className="font-bold text-neutral-950">Start Service Now</span>
            <span className="text-xs leading-snug text-neutral-700">Begin treatment and start the service timer.</span>
          </button>
          <button type="button" disabled={busy} onClick={onArrived} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-center shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
            <UserPlus className="size-8 text-slate-700" aria-hidden="true" />
            <span className="font-bold leading-tight text-neutral-950">Customer Arrived — Waiting</span>
            <span className="text-xs leading-snug text-neutral-700">Guest is at the spa. Treatment has not started.</span>
          </button>
          <button type="button" disabled={busy} onClick={onNotArrived} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-center shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50">
            <UserX className="size-8 text-red-700" aria-hidden="true" />
            <span className="font-bold text-neutral-950">Customer Not Arrived</span>
            <span className="text-xs leading-snug text-neutral-700">Record absence and keep the booking active for follow-up.</span>
          </button>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
          {action.groupReference ? <Info className="size-4 shrink-0" aria-hidden="true" /> : <Clock3 className="size-4 shrink-0" aria-hidden="true" />}
          <p>{action.groupReference
            ? `This action applies only to ${action.recipientName} in group booking ${action.groupReference}.`
            : "The booking remains open until its service state is confirmed."}</p>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}
