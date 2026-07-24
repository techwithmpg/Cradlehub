"use client";

import Link from "next/link";
import { Clock3, MapPin, UserRound } from "lucide-react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { CrmReadinessDetail } from "./crm-readiness-detail";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import type { ReadinessIssue } from "@/types/readiness";
import type { RecentAttendanceScan } from "@/lib/attendance/types";
import {
  formatAttendanceScanTime,
  formatShiftTypeLabel,
  getAttendanceScanEventLabel,
} from "@/lib/attendance/scan-feed";

export function CradleFlowReadinessDialog({
  open,
  onOpenChange,
  issues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ReadinessIssue[];
}) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="lg"
      ariaLabel="System readiness"
    >
      <AdminOverlayHeader
        title="System Readiness"
        description="Review launch-critical and operational warnings."
      />
      <AdminOverlayBody>
        <CrmReadinessDetail issues={issues} />
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
        >
          Close
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}

export function CradleFlowDayTotalsDialog({
  open,
  onOpenChange,
  payment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: CrmTodayPayment | null;
}) {
  const methods = payment?.by_method;
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="md"
      ariaLabel="Day totals"
    >
      <AdminOverlayHeader
        title="Day Totals"
        description="Live booking collections for this branch and business date."
      />
      <AdminOverlayBody className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Expected", payment?.total_expected ?? 0],
            ["Collected", payment?.total_collected ?? 0],
            ["Outstanding", payment?.total_unpaid ?? 0],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3"
            >
              <div className="text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-extrabold text-[var(--cs-text)]">
                {formatCradleFlowMoney(Number(value))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["cash", "gcash", "maya", "card", "other"] as const).map((method) => (
            <div
              key={method}
              className="flex items-center justify-between rounded-lg border border-[var(--cs-border-soft)] px-3 py-2 text-sm"
            >
              <span className="capitalize text-[var(--cs-text-secondary)]">{method}</span>
              <strong>{formatCradleFlowMoney(methods?.[method] ?? 0)}</strong>
            </div>
          ))}
        </div>
        <p className="text-xs leading-5 text-[var(--cs-text-muted)]">
          Formal drawer close, discrepancy notes, and manager sign-off remain in Close Day.
        </p>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-between gap-2">
        <Link
          href="/crm/reconciliation"
          className="inline-flex h-10 items-center rounded-lg border border-[var(--cs-border)] px-4 text-sm font-bold"
        >
          Open Close Day
        </Link>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
        >
          Close
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}

export function CradleFlowAttendanceDialog({
  scan,
  open,
  onOpenChange,
}: {
  scan: RecentAttendanceScan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!scan) return null;
  const name = scan.staffNickname || scan.staffName;
  const details = [
    [
      <Clock3 key="time" className="size-4" />,
      "Activity",
      `${getAttendanceScanEventLabel(scan)} at ${formatAttendanceScanTime(scan.occurredAt, scan.timezone)}`,
    ],
    [
      <UserRound key="shift" className="size-4" />,
      "Shift",
      scan.shiftType ? formatShiftTypeLabel(scan.shiftType) : "No shift label",
    ],
    [<MapPin key="branch" className="size-4" />, "Branch", scan.branchName ?? "Not recorded"],
  ] as const;
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="sm"
      ariaLabel="Attendance details"
    >
      <AdminOverlayHeader title={name} description="Live attendance activity" />
      <AdminOverlayBody className="grid gap-2">
        {details.map(([icon, label, value]) => (
          <div
            key={label}
            className="flex gap-3 rounded-lg border border-[var(--cs-border-soft)] p-3"
          >
            <span className="text-[var(--cs-sand-dark)]">{icon}</span>
            <span>
              <span className="block text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                {label}
              </span>
              <span className="mt-1 block text-sm font-semibold">{value}</span>
            </span>
          </div>
        ))}
        {scan.message ? (
          <p className="rounded-lg bg-[var(--cs-surface-warm)] p-3 text-sm">{scan.message}</p>
        ) : null}
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
        >
          Close
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
