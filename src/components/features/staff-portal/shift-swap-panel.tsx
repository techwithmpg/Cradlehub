"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Clock, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  getShiftSwapContextAction,
  requestPeerShiftSwapAction,
  respondToPeerShiftSwapAction,
  type ShiftSwapContextResult,
} from "@/lib/schedule/shift-swap-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function StaffShiftSwapBar({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<Extract<ShiftSwapContextResult, { ok: true }> | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [colleagueId, setColleagueId] = useState<string>("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const effectiveDate = selectedDate || new Date().toISOString().slice(0, 10);

  const loadContext = useCallback(async (dateToLoad: string) => {
    setLoading(true);
    try {
      const res = await getShiftSwapContextAction(dateToLoad);
      if (res.ok) {
        setContext(res);
        if (res.colleagues.length > 0 && !colleagueId) {
          setColleagueId(res.colleagues[0]!.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [colleagueId]);

  useEffect(() => {
    void loadContext(effectiveDate);
  }, [effectiveDate, loadContext]);

  const incomingSwaps = context?.pendingSwaps.filter((s) => s.direction === "incoming") ?? [];
  const outgoingSwaps = context?.pendingSwaps.filter((s) => s.direction === "outgoing") ?? [];

  function handleRequestSwap() {
    if (!colleagueId) {
      toast.error("Please choose a colleague to swap with.");
      return;
    }
    startTransition(async () => {
      const res = await requestPeerShiftSwapAction({
        targetDate: effectiveDate,
        colleagueStaffId: colleagueId,
        note,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      setNote("");
      void loadContext(effectiveDate);
      router.refresh();
    });
  }

  function handleRespond(notificationId: string, decision: "accept" | "decline") {
    startTransition(async () => {
      const res = await respondToPeerShiftSwapAction({ notificationId, decision });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      void loadContext(effectiveDate);
      router.refresh();
    });
  }

  const formattedDate = new Date(`${effectiveDate}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[480px] md:max-w-none space-y-2.5 my-3">
      {/* 1. Incoming Shift Swap Requests Waiting for 1-Tap Acceptance */}
      {incomingSwaps.map((swap) => (
        <div
          key={swap.notificationId}
          className="rounded-2xl border border-amber-300 bg-amber-50/95 p-4 text-amber-950 shadow-sm space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">
              <Sparkles className="size-3" />
              Shift Swap Request · {swap.targetDate}
            </span>
          </div>
          <p className="text-sm font-bold leading-snug">
            {swap.requesterName} wants to swap shifts with you on {swap.targetDate}
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/80 p-2.5 text-xs">
            <div>
              <span className="text-stone-500 block">You take {swap.requesterName}'s shift:</span>
              <strong className="text-emerald-900">{swap.requesterShiftSummary}</strong>
            </div>
            <div>
              <span className="text-stone-500 block">{swap.requesterName} takes yours:</span>
              <strong className="text-stone-800">{swap.colleagueShiftSummary}</strong>
            </div>
          </div>
          {swap.note ? (
            <p className="text-xs italic text-amber-900">“{swap.note}”</p>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleRespond(swap.notificationId, "accept")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0D5C43] px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#163a2b] disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {pending ? "Updating Schedule…" : "Accept Temporary Swap"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleRespond(swap.notificationId, "decline")}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              <X className="size-3.5" />
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* 2. Outgoing Pending Requests */}
      {outgoingSwaps.map((swap) => (
        <div
          key={swap.notificationId}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E1D7] bg-white px-3.5 py-2.5 text-xs shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-600 shrink-0" />
            <span>
              Waiting for <strong>{swap.colleagueName}</strong> to accept your swap on{" "}
              <strong>{swap.targetDate}</strong>
            </span>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleRespond(swap.notificationId, "decline")}
            className="text-red-700 font-semibold hover:underline"
          >
            Cancel
          </button>
        </div>
      ))}

      {/* 3. Trigger Bar to Request a Temporary Shift Swap */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E1D7] bg-white px-4 py-3 shadow-2xs">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#163A2B]">
            Need a colleague to cover or trade shifts on {formattedDate}?
          </p>
          <p className="text-[11px] text-[#61728A]">
            Swaps apply to this date only and update QR Attendance automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#163A2B] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 hover:bg-[#0D5C43]"
        >
          <ArrowLeftRight className="size-3.5" />
          Swap Shift
        </button>
      </div>

      {/* 4. Shift Swap Request Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#163A2B]">
              <ArrowLeftRight className="size-4 text-[#0D5C43]" />
              Temporary Shift Swap · {formattedDate}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Your permanent weekly schedule will not change. Once your colleague accepts, QR
              Attendance will automatically recognize the swap for {formattedDate}.
            </DialogDescription>
          </DialogHeader>

          {loading || !context ? (
            <div className="py-6 text-center text-xs text-stone-500">
              Loading colleague schedules for {formattedDate}…
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-[#E8E1D7] bg-[#F7F3EB]/70 p-3 text-xs">
                <span className="text-stone-500">Your current schedule on {formattedDate}:</span>
                <p className="mt-0.5 text-sm font-bold text-[#163A2B]">
                  {context.myShift.summary}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800">
                  Choose Colleague to Swap With
                </label>
                {context.colleagues.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    No eligible colleagues found in your branch for this role.
                  </p>
                ) : (
                  <select
                    value={colleagueId}
                    onChange={(e) => setColleagueId(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-medium text-stone-900 focus:border-[#0D5C43] focus:outline-none"
                  >
                    {context.colleagues.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.fullName} — ({col.shiftSummary} on {formattedDate})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800">
                  Short Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Can we trade Friday shifts? I have a family appointment."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs focus:border-[#0D5C43] focus:outline-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || !context || context.colleagues.length === 0}
              onClick={handleRequestSwap}
              className="bg-[#0D5C43] text-white hover:bg-[#163A2B]"
            >
              <Send className="mr-1.5 size-3.5" />
              {pending ? "Sending Push…" : "Send Swap Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
