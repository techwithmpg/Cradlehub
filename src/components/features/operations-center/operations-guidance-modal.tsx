"use client";

import Link from "next/link";
import { ArrowUpRight, CircleHelp, QrCode, ShieldCheck, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OperationsIssue, OperationsScan } from "@/lib/operations-center/issue-model";

/**
 * A guided fallback and diagnostic modal for checks and scan attempts that
 * do not yet have a direct inline mutation, or require specific technical instructions.
 */
export function OperationsGuidanceModal({
  issue,
  scan,
  onClose,
  onOpenDeviceRecovery,
}: {
  issue: OperationsIssue | null;
  scan: OperationsScan | null;
  onClose: () => void;
  onOpenDeviceRecovery?: (staffId: string) => void;
}) {
  if (!issue && !scan) return null;

  const isIssue = Boolean(issue);
  const title = issue?.title ?? (scan ? scan.staffName + " — scan needs review" : "Issue review");
  const description = issue?.description ?? scan?.message ?? "Review the recorded problem.";
  const code = (issue?.code ?? scan?.reasonCode ?? "").toUpperCase();
  const target = issue?.actionHref ?? "/crm/attendance?view=review";
  const label = issue?.actionLabel ?? "Open Attendance Review";

  const isDeviceLimit = code === "DEVICE_LIMIT_REACHED" || code.includes("DEVICE_LIMIT");
  const isUtilityQr =
    code.includes("QR") ||
    description.toLowerCase().includes("qr") ||
    description.toLowerCase().includes("camera") ||
    title.toLowerCase().includes("utility");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[min(100%-2rem,580px)] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-5 text-sm">
          {code ? (
            <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs">
              <span className="font-semibold">Diagnostic Code: </span>
              <code className="font-mono">{code}</code>
              {issue?.scanIdSuffix || scan?.scanIdSuffix ? (
                <span className="ml-2">· Receipt Suffix: <code className="font-mono">{issue?.scanIdSuffix ?? scan?.scanIdSuffix}</code></span>
              ) : null}
            </div>
          ) : null}

          {/* Utility Staff QR Diagnostic Guidance */}
          {isUtilityQr ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <QrCode size={15} aria-hidden />
                Utility Staff QR Scanning Diagnostics
              </div>
              <p className="mt-1 leading-5">
                If utility or operational staff cannot scan the branch QR code:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-blue-900/90">
                <li><strong>Browser Permissions: </strong>Ensure Safari / Chrome has permission to use the camera on the device.</li>
                <li><strong>Branch Target: </strong>Verify the physical poster or tablet shows an active Attendance QR code for this specific branch.</li>
                <li><strong>Staff Account Status: </strong>Ensure the staff member is active and assigned to this branch.</li>
                <li><strong>Front-Desk Fallback: </strong>If the phone camera is damaged or unable to scan, Front Desk staff can record manual clock-in via Attendance Records.</li>
              </ul>
            </div>
          ) : null}

          {/* Device Limit Explanation */}
          {isDeviceLimit ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Wrench size={15} aria-hidden />
                Device Limit Reached (Security Safeguard)
              </div>
              <p className="mt-1 leading-5">
                Each staff member is restricted to a maximum number of active registered attendance phones. To connect a replacement phone, authorized staff must select and disconnect the obsolete device.
              </p>
              {scan?.staffId && onOpenDeviceRecovery ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-800 text-white hover:bg-amber-900"
                    onClick={() => {
                      onClose();
                      onOpenDeviceRecovery(scan.staffId!);
                    }}
                  >
                    Open Device Recovery Workflow
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-3">
            <CircleHelp size={19} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" aria-hidden />
            <div>
              <p className="font-semibold">Recommended Correction</p>
              <p className="mt-1 text-xs text-[var(--cs-text-secondary)] leading-5">
                {issue?.guidance ??
                  "Review the stored exception and attendance records. After performing any authorized correction, verify that subsequent check-ins succeed."}
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <p className="font-semibold text-stone-900">Resolution Verification Required</p>
              <p className="mt-1 text-[var(--cs-text-secondary)]">
                {isIssue
                  ? "Changes made in external editors require returning here and refreshing checks to confirm the problem is cleared."
                  : "An unsuccessful scan is an audit record. Generating a recovery link or updating settings does not mark attendance as resolved until the staff member completes a verified scan."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 gap-2 border-t border-[var(--cs-border-soft)] p-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button asChild>
            <Link href={target}>{label} <ArrowUpRight size={15} aria-hidden /></Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
