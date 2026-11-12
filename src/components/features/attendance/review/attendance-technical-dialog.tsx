"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  LogIn,
  LogOut,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  quickFixAttendanceExceptionAction,
  resetStaffPhoneAndNotifyAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type {
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

function formatFriendlyDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPlainEnglishExplanation(item: AttendanceReviewItem, staffName: string, timeLabel: string) {
  const code = (item.diagnostic.code || "").toUpperCase();
  if (code.includes("DEVICE") || code.includes("PHONE")) {
    return {
      badge: "Phone Connection Needed",
      headline: `${staffName}'s phone needs to be reconnected`,
      explanation:
        "They scanned from a new browser, cleared their browser data, or reached the registered phone limit.",
      tip: "Click 'Reset Phone & Send Link' below. It will clear their old phone record and send a 1-tap connect link straight to their Staff Portal.",
    };
  }
  if (code.includes("MISMATCH") || code.includes("OPEN") || code.includes("FORGOT")) {
    return {
      badge: "Unclosed Shift or Unclear Scan",
      headline: `${staffName} scanned around ${timeLabel}, and an earlier shift was still open`,
      explanation:
        "When a staff member forgets to clock out on an earlier shift, their next scan is paused so you can confirm whether they are clocking in or clocking out.",
      tip: "Choose how to record this scan below—or click 'Sync & Approve Record' to let CradleHub automatically match their saved scans.",
    };
  }
  return {
    badge: "Quick Attendance Check",
    headline: `Review ${staffName}'s scan from ${timeLabel}`,
    explanation: item.diagnostic.crmSummary || "Confirm how this attendance scan should be recorded.",
    tip: "Select one of the quick actions below to update their attendance and clear this alert.",
  };
}

export function AttendanceTechnicalDialog({
  open,
  onOpenChange,
  data,
  item,
  record,
  scanEvent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
  onSaved: () => void;
  onOpenPhoneSetup?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const staffName =
    item.exception.staff_name ??
    record?.staff_name ??
    item.title.replace(/ has an .*$/i, "") ??
    "Staff member";
  const staffId = item.exception.staff_id ?? record?.staff_id ?? scanEvent?.staff_id ?? null;
  const detectedTime =
    scanEvent?.created_at ?? item.exception.last_detected_at ?? item.exception.detected_at;
  const timeLabel = formatFriendlyDateTime(detectedTime, data.timezone);
  const copy = getPlainEnglishExplanation(item, staffName, timeLabel);

  function handleQuickFix(
    mode: "confirm_clock_in" | "confirm_clock_out" | "sync_and_close" | "dismiss_invalid"
  ) {
    startTransition(async () => {
      const result = await quickFixAttendanceExceptionAction({
        exceptionId: item.exception.id,
        staffId,
        checkinId: record?.id ?? item.exception.checkin_id ?? null,
        scanTimeIso: detectedTime,
        mode,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      onSaved();
    });
  }

  function handleResetPhone() {
    if (!staffId) {
      toast.error("No staff profile is linked to this scan.");
      return;
    }
    startTransition(async () => {
      const result = await resetStaffPhoneAndNotifyAction({
        staffId,
        exceptionId: item.exception.id,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.activationUrl) {
        setGeneratedLink(result.activationUrl);
      } else {
        onOpenChange(false);
        onSaved();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-5">
          <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            <Clock className="size-3.5" />
            {copy.badge}
          </span>
          <DialogTitle className="text-lg font-bold text-[var(--cs-text)]">
            {copy.headline}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--cs-text-secondary)]">
            {copy.explanation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* Simple Context Strip */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-stone-50/70 p-3.5 text-xs">
            <div>
              <span className="text-[var(--cs-text-muted)]">Staff Member</span>
              <p className="mt-0.5 font-semibold text-[var(--cs-text)]">{staffName}</p>
            </div>
            <div>
              <span className="text-[var(--cs-text-muted)]">Scan Time</span>
              <p className="mt-0.5 font-semibold text-[var(--cs-text)]">{timeLabel}</p>
            </div>
          </div>

          {generatedLink ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-950 font-semibold text-sm">
                <CheckCircle2 className="size-4 text-emerald-700" />
                Phone Reset & Link Sent to {staffName}'s Portal!
              </div>
              <p className="text-xs text-emerald-900">
                {staffName} received a notification in their Staff Portal. You can also copy this link and send it via chat:
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-stone-800"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(generatedLink);
                    toast.success("Reconnect link copied!");
                  }}
                >
                  <Copy className="mr-1.5 size-3.5" />
                  Copy Link
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-[var(--cs-text-muted)]">{copy.tip}</p>

              {/* 1-Click Self-Service Action Buttons */}
              <div className="grid gap-2.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleQuickFix("sync_and_close")}
                  className="flex w-full items-center justify-between rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-3 text-left text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-900 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="size-4 text-amber-300" />
                    <span>
                      Sync & Approve Attendance Record
                      <span className="block text-[11px] font-normal text-emerald-100">
                        Automatically matches their saved scans and clears this alert
                      </span>
                    </span>
                  </span>
                  <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs">Recommended</span>
                </button>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleQuickFix("confirm_clock_in")}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--cs-border)] bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
                  >
                    <LogIn className="size-4 text-emerald-700 shrink-0" />
                    <span>
                      Record as Clock-In
                      <span className="block text-[11px] font-normal text-[var(--cs-text-muted)]">
                        Use {timeLabel} as arrival
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleQuickFix("confirm_clock_out")}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--cs-border)] bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
                  >
                    <LogOut className="size-4 text-amber-700 shrink-0" />
                    <span>
                      Record as Clock-Out
                      <span className="block text-[11px] font-normal text-[var(--cs-text-muted)]">
                        Close open shift at {timeLabel}
                      </span>
                    </span>
                  </button>
                </div>

                {staffId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleResetPhone}
                    className="flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50/80 px-3.5 py-2.5 text-left text-xs font-semibold text-amber-950 hover:bg-amber-100/80 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <Smartphone className="size-4 text-amber-800 shrink-0" />
                      <span>
                        Reset Phone & Send Reconnect Link to Portal
                        <span className="block text-[11px] font-normal text-amber-800">
                          Use if {staffName} switched phones or cannot scan QR
                        </span>
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-[var(--cs-border-soft)] bg-stone-50 px-5 py-3">
          {!generatedLink ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleQuickFix("dismiss_invalid")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Ignore accidental scan
            </button>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              if (generatedLink) onSaved();
            }}
          >
            {generatedLink ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
