"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleCheckBig, Clock3, Copy, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
import type { BranchCorrectionScanDetails } from "@/lib/staff/branch-correction-types";
import {
  formatAttendanceDate,
  formatAttendanceTime,
  formatShiftLabel,
  formatWorkedMinutes,
} from "./public-scan-format";
import styles from "./public-scan-processor.module.css";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Countdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dueMs = new Date(dueAt).getTime();
  const remaining = Number.isFinite(dueMs) ? dueMs - now : 0;

  return <strong className={styles.countdown}>{formatRemaining(remaining)}</strong>;
}

type PublicScanResultViewProps = {
  result: PublicScanResult;
  branchCorrectionState?: {
    status: "idle" | "pending" | "success" | "error";
    message: string | null;
  };
  onRequestBranchCorrection?: (details: BranchCorrectionScanDetails) => void;
  onTryAnotherAccount?: (details: BranchCorrectionScanDetails) => void;
};

function supportReceipt(result: PublicScanResult): string {
  return (result.scanEventId ?? result.operationId ?? "attendance")
    .replaceAll("-", "")
    .slice(-8)
    .toUpperCase();
}

function attendanceChanged(result: PublicScanResult): boolean {
  return Boolean(result.attendance);
}

async function copySupportDetails(result: PublicScanResult): Promise<void> {
  const text = [
    "Attendance scan",
    `Problem: ${result.title}`,
    `Code: ${result.reasonCode?.toUpperCase() ?? "ATTENDANCE_REVIEW"}`,
    `Receipt: ${supportReceipt(result)}`,
    `Attendance changed: ${attendanceChanged(result) ? "Yes" : "No"}`,
  ].join("\n");
  await navigator.clipboard.writeText(text);
  toast.success("Attendance support details copied.");
}

function BranchCorrectionCard({
  details,
  state,
  onRequest,
  onTryAnotherAccount,
}: {
  details: BranchCorrectionScanDetails;
  state: NonNullable<PublicScanResultViewProps["branchCorrectionState"]>;
  onRequest?: (details: BranchCorrectionScanDetails) => void;
  onTryAnotherAccount?: (details: BranchCorrectionScanDetails) => void;
}) {
  const pendingRequest = details.existingPendingRequest;
  const disabled =
    state.status === "pending" ||
    state.status === "success" ||
    details.canRequestBranchCorrection === false ||
    Boolean(pendingRequest);

  return (
    <div className={styles.branchCorrectionCard}>
      <div className={styles.branchCorrectionRows}>
        <div>
          <span>Your profile</span>
          <strong>{details.currentBranchName}</strong>
        </div>
        <div>
          <span>This QR</span>
          <strong>{details.requestedBranchName}</strong>
        </div>
      </div>

      {pendingRequest ? (
        <div className={styles.branchCorrectionPending}>
          <strong>Branch correction is already pending.</strong>
          <span>Wait for the front desk. Do not scan again.</span>
        </div>
      ) : null}

      {state.message ? (
        <p
          className={cn(
            styles.branchCorrectionMessage,
            state.status === "success" && styles.branchCorrectionMessageSuccess,
            state.status === "error" && styles.branchCorrectionMessageError
          )}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className={styles.branchCorrectionActions}>
        <button
          type="button"
          className={styles.branchCorrectionButton}
          disabled={disabled}
          onClick={() => onRequest?.(details)}
        >
          {state.status === "pending" ? (
            <>
              <Loader2 size={16} className={styles.loginSpinner} aria-hidden="true" />
              Sending…
            </>
          ) : (
            "Request branch correction"
          )}
        </button>
        <button
          type="button"
          className={styles.branchCorrectionSecondaryButton}
          onClick={() => onTryAnotherAccount?.(details)}
        >
          Use another account
        </button>
      </div>
    </div>
  );
}

function SupportDetails({ result }: { result: PublicScanResult }) {
  return (
    <details className="w-full rounded-xl border border-stone-200 bg-white p-3 text-left text-sm text-stone-700">
      <summary className="cursor-pointer font-semibold text-stone-900">Help details</summary>
      <div className="mt-3 grid gap-2">
        <span>Problem code: {result.reasonCode?.toUpperCase() ?? "ATTENDANCE_REVIEW"}</span>
        <span>Scan receipt: {supportReceipt(result)}</span>
        {result.securityNote &&
        result.securityNote.trim().toLowerCase() !==
          `attendance changed: ${attendanceChanged(result) ? "yes" : "no"}` ? (
          <span>{result.securityNote}</span>
        ) : null}
        <button
          type="button"
          onClick={() => void copySupportDetails(result)}
          className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-900"
        >
          <Copy size={15} aria-hidden="true" /> Copy support details
        </button>
      </div>
    </details>
  );
}

function isReviewResult(result: PublicScanResult): boolean {
  return !result.attendance && result.ok && result.outcome === "exception";
}

export function PublicScanResultView({
  result,
  branchCorrectionState = { status: "idle", message: null },
  onRequestBranchCorrection,
  onTryAnotherAccount,
}: PublicScanResultViewProps) {
  const attendance = result.attendance;
  const isClockIn = attendance?.action === "clock_in";
  const isWrongBranch = result.reasonCode === "wrong_branch" && result.branchCorrection;
  const isReview = isReviewResult(result) && !isWrongBranch;

  if (attendance) {
    return (
      <section className={cn(styles.resultPanel, styles.attendanceSuccess)} aria-live="polite">
        <BrandLogo mode="mark" size="sm" className={styles.brandMark} />
        <div className={styles.successIcon} aria-hidden="true">
          <Check size={38} strokeWidth={2.4} />
        </div>
        <div className={styles.resultHeading}>
          <p className={styles.successEyebrow}>
            {formatAttendanceDate(attendance.occurredAt, attendance.branchTimezone)}
          </p>
          <h1>{isClockIn ? "Clocked in" : "Clocked out"}</h1>
          <div className={styles.attendanceTime}>
            {formatAttendanceTime(attendance.occurredAt, attendance.branchTimezone)}
          </div>
          <p className={styles.successMessage}>You may close this page.</p>
        </div>

        {result.reviewLabel ? (
          <div className={styles.reviewBadge} role="status" aria-label={result.reviewLabel}>
            {result.reviewLabel}
          </div>
        ) : null}

        {result.isTest ? (
          <div className={styles.trainingBadge} role="status" aria-label="Training Mode">
            Training Mode · Not live Attendance
          </div>
        ) : null}

        <div className={styles.identitySummary}>
          <strong>{attendance.staffName}</strong>
          <span>
            <MapPin size={14} aria-hidden="true" />
            {attendance.branchName}
          </span>
          <em>{formatShiftLabel(attendance.shiftLabel)}</em>
        </div>

        {!isClockIn ? (
          <div className={styles.summaryCard}>
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <span>Worked today</span>
              <strong>{formatWorkedMinutes(attendance.workedMinutes)}</strong>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (isWrongBranch && result.branchCorrection) {
    return (
      <section className={cn(styles.resultPanel, styles.resultBlocked)} aria-live="polite">
        <BrandLogo mode="mark" size="sm" className={styles.brandMark} />
        <div className={styles.genericResultIcon} aria-hidden="true">
          <AlertTriangle size={42} strokeWidth={1.8} />
        </div>
        <div className={styles.genericResultCopy}>
          <p className={styles.eyebrow}>Wrong branch</p>
          <h1>This QR belongs to {result.branchCorrection.requestedBranchName}</h1>
          <p>
            Your profile is assigned to {result.branchCorrection.currentBranchName}. No Attendance
            change was made.
          </p>
        </div>
        <BranchCorrectionCard
          details={{
            ...result.branchCorrection,
            scanEventId: result.branchCorrection.scanEventId ?? result.scanEventId,
          }}
          state={branchCorrectionState}
          onRequest={onRequestBranchCorrection}
          onTryAnotherAccount={onTryAnotherAccount}
        />
        <SupportDetails result={result} />
      </section>
    );
  }

  if (isReview) {
    return (
      <section className={cn(styles.resultPanel, styles.resultInfo)} aria-live="polite">
        <BrandLogo mode="mark" size="sm" className={styles.brandMark} />
        <div className={styles.genericResultIcon} aria-hidden="true">
          <CircleCheckBig size={42} strokeWidth={1.8} />
        </div>
        <div className={styles.genericResultCopy}>
          <p className={styles.eyebrow}>Scan received</p>
          <h1>Scan saved</h1>
          <p>The front desk will review your Attendance. Do not scan again.</p>
          <strong className="mt-3 block text-sm">Attendance changed: No</strong>
        </div>
        <SupportDetails result={result} />
      </section>
    );
  }

  return (
    <section
      className={cn(styles.resultPanel, result.ok ? styles.resultSuccess : styles.resultBlocked)}
      aria-live="polite"
    >
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />
      <div className={styles.genericResultIcon} aria-hidden="true">
        {result.ok ? (
          <CircleCheckBig size={42} strokeWidth={1.8} />
        ) : (
          <AlertTriangle size={42} strokeWidth={1.8} />
        )}
      </div>
      <div className={styles.genericResultCopy}>
        <p className={styles.eyebrow}>{result.ok ? "Scan complete" : "Action needed"}</p>
        <h1>{result.title}</h1>
        <p>{result.message}</p>
        {!result.ok ? <strong className="mt-3 block text-sm">Attendance changed: No</strong> : null}
      </div>

      {result.nextHref ? (
        <a
          href={result.nextHref}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#115D47] px-4 py-2 text-sm font-bold text-white"
        >
          Continue
        </a>
      ) : null}

      {result.countdown ? (
        <div className={styles.serviceCard}>
          <div>
            <span>Active service</span>
            <strong>{result.countdown.serviceName}</strong>
            <small>{result.countdown.customerName}</small>
          </div>
          <div className={styles.countdownWrap}>
            <span>Remaining</span>
            <Countdown dueAt={result.countdown.dueAt} />
          </div>
        </div>
      ) : null}

      <SupportDetails result={result} />
    </section>
  );
}
