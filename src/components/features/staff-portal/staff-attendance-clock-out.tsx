"use client";

import { useState, useTransition } from "react";
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
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
  } | null>(null);
  const expected = formatTime(availability.expectedClockOutAt, timezone);
  const nextAssignment = formatTime(availability.nextAssignmentAt, timezone);

  const submit = () => {
    startTransition(async () => {
      const next = await clockOutFromStaffPortalAction();
      setResult(next);
      if (next.ok) router.refresh();
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{result?.title ?? availability.label}</p>
        <p className="text-xs text-muted-foreground">
          {result?.message ?? availability.message}
          {!result && nextAssignment ? ` Next assignment: ${nextAssignment}.` : ""}
          {!result && !nextAssignment && expected ? ` Expected completion: ${expected}.` : ""}
        </p>
      </div>
      {availability.enabled && !result?.ok ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={isPending}
          onClick={submit}
        >
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
