"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { consumeDeviceRecoveryLinkAction } from "@/app/scan/actions";
import { Button } from "@/components/ui/button";
import { formatDeviceReason } from "@/lib/attendance/device-display";
import type { PublicScanResult, RecoveryTokenPreview } from "@/lib/attendance/types";

function formatRecoveryExpiry(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")} Asia/Manila`;
}

export function DeviceRecoveryScreen({
  token,
  preview,
}: {
  token: string;
  preview: RecoveryTokenPreview;
}) {
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function restoreAccess() {
    startTransition(async () => {
      setResult(await consumeDeviceRecoveryLinkAction({ token }));
    });
  }

  if (result) {
    return (
      <RecoveryCard eyebrow={result.ok ? "Access restored" : "Recovery unavailable"} title={result.title}>
        <p className="text-sm leading-6 text-stone-600">{result.message}</p>
        {result.detail ? <p className="text-xs font-semibold text-stone-500">{result.detail}</p> : null}
        {result.ok ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-800/15 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4" />
            Phone connected successfully
          </div>
        ) : null}
      </RecoveryCard>
    );
  }

  if (!preview.ok) {
    return (
      <RecoveryCard eyebrow="Recovery unavailable" title={preview.title}>
        <p className="text-sm leading-6 text-stone-600">{preview.message}</p>
      </RecoveryCard>
    );
  }

  return (
    <RecoveryCard eyebrow="Restore attendance access" title={preview.staffName}>
      <div className="text-sm font-semibold text-stone-600">
        {formatDeviceReason(preview.staffType)} - {preview.branchName}
      </div>
      <p className="text-sm leading-6 text-stone-600">
        This will register this phone for future attendance and service QR scans.
      </p>
      <div className="rounded-lg border border-amber-700/20 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Do not continue on a shared or public phone.
      </div>
      <div className="text-xs text-stone-500">
        Reason: {formatDeviceReason(preview.reason)}. Expires {formatRecoveryExpiry(preview.expiresAt)}.
      </div>
      <Button
        type="button"
        className="h-11 bg-[#9A6A3A] text-white hover:bg-[#82572F]"
        disabled={isPending}
        onClick={restoreAccess}
      >
        <ShieldCheck data-icon="inline-start" />
        {isPending ? "Securing attendance access..." : "Restore access on this phone"}
      </Button>
    </RecoveryCard>
  );
}

function RecoveryCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid w-[min(100%,420px)] gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_20px_70px_rgba(41,32,24,0.14)]">
      <div className="grid gap-1 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A3A]">{eyebrow}</div>
        <h1 className="text-2xl font-bold tracking-normal text-stone-950">{title}</h1>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
