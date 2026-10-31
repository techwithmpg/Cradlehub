"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClockArrowDown, LoaderCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockOutFromStaffPortalAction } from "@/app/(dashboard)/staff-portal/actions";
import type { StaffPortalClockOutAvailability } from "@/lib/staff-portal/attendance";

function formatTime(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function StaffAttendanceClockOut({
  availability,
  timezone,
}: {
  availability: StaffPortalClockOutAvailability;
  timezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const completed = useRef(false);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    checkedOutAt?: string;
  } | null>(null);
  const expected = formatTime(availability.expectedClockOutAt, timezone);
  const nextAssignment = formatTime(availability.nextAssignmentAt, timezone);

  const submit = () => {
    if (submitting.current || completed.current || result?.ok || !availability.enabled) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        const next = await clockOutFromStaffPortalAction();
        setResult(next);
        if (next.ok) {
          completed.current = true;
          router.refresh();
        }
      } catch {
        setResult({ ok: false, title: "Clock-out unavailable", message: "Please retry or ask CRM for help." });
      } finally {
        submitting.current = false;
      }
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0" aria-live="polite">
        <p className="text-sm font-medium">{result?.title ?? availability.label}</p>
        <p className="text-xs text-muted-foreground">
          {result?.message ?? availability.message}
          {result?.ok && result.checkedOutAt ? ` Clocked out at ${formatTime(result.checkedOutAt, timezone)}` : ""}
          {!result && nextAssignment ? ` Next assignment: ${nextAssignment}.` : ""}
          {!result && !nextAssignment && expected ? ` Expected completion: ${expected}.` : ""}
        </p>
      </div>
      {availability.enabled && !result?.ok ? (
        <Button type="button" size="sm" className="min-h-11 shrink-0" disabled={isPending} onClick={submit}>
          {isPending ? <LoaderCircle className="animate-spin" /> : <ClockArrowDown />}
          {isPending ? "Clocking out…" : "Clock out"}
        </Button>
      ) : availability.code === "use_branch_qr" ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <QrCode className="size-4" /> Branch QR
        </span>
      ) : null}
    </div>
  );
}
