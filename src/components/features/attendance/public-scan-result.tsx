"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleCheckBig,
  Clock3,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
} from "lucide-react";
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

function getResultStatusClass(result: PublicScanResult): string | undefined {
  if (result.outcome === "noop" || result.severity === "info") return styles.resultInfo;
  return result.ok ? styles.resultSuccess : styles.resultBlocked;
}

function getResultEyebrow(result: PublicScanResult): string {
  if (result.reasonCode === "unknown_device") return "Staff sign-in";
  if (result.reasonCode === "device_restored") return "Access restored";
  if (result.outcome === "error") return "Scan interrupted";
  if (result.outcome === "noop") return "No change needed";
  return result.ok ? "Scan accepted" : "Action needed";
}

function ResultStatusIcon({ result }: { result: PublicScanResult }) {
  if (result.outcome === "noop") return <Clock3 size={42} strokeWidth={1.8} />;
  if (result.ok) return <CircleCheckBig size={42} strokeWidth={1.8} />;
  return <AlertTriangle size={42} strokeWidth={1.8} />;
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
  const pendingCreatedAt = pendingRequest
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(pendingRequest.createdAt))
    : null;

  return (
    <div className={styles.branchCorrectionCard}>
      <p className={styles.branchCorrectionHint}>
        If this is wrong, request branch correction.
      </p>

      <div className={styles.branchCorrectionRows}>
        <div>
          <span>Your profile is currently assigned to</span>
          <strong>{details.currentBranchName}</strong>
        </div>
        <div>
          <span>This QR is for</span>
          <strong>{details.requestedBranchName}</strong>
        </div>
      </div>

      {pendingRequest ? (
        <div className={styles.branchCorrectionPending}>
          <strong>Branch correction request already pending.</strong>
          <span>
            Requested branch: {pendingRequest.requestedBranchName}
            {pendingCreatedAt ? ` · Sent ${pendingCreatedAt}` : ""}
          </span>
        </div>
      ) : (
        <p className={styles.branchCorrectionMessage}>
          Your request must be approved by the front desk before scanning again.
        </p>
      )}

      <div className={styles.branchCorrectionActions}>
        <button
          type="button"
          className={styles.branchCorrectionButton}
          disabled={disabled}
          onClick={() => onRequest?.(details)}
        >
          {state.status === "pending" ? (
            <Loader2 size={16} className={styles.loginSpinner} aria-hidden="true" />
          ) : (
            <Send size={16} aria-hidden="true" />
          )}
          {state.status === "success" ? "Request sent" : "Request branch correction"}
        </button>

        {onTryAnotherAccount ? (
          <button
            type="button"
            className={styles.branchCorrectionSecondaryButton}
            onClick={() => onTryAnotherAccount(details)}
          >
            Try another account
          </button>
        ) : null}
      </div>

      {state.message ? (
        <p
          className={cn(
            styles.branchCorrectionMessage,
            state.status === "error" && styles.branchCorrectionMessageError,
            state.status === "success" && styles.branchCorrectionMessageSuccess
          )}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function PublicScanResultView({
  result,
  branchCorrectionState = { status: "idle", message: null },
  onRequestBranchCorrection,
  onTryAnotherAccount,
}: PublicScanResultViewProps) {
  const attendance = result.attendance;
  const isClockIn = attendance?.action === "clock_in";
  const isAttendanceSuccess = result.ok && Boolean(attendance);
  const statusClass = getResultStatusClass(result);
  const resolution = result.resolution;

  if (isAttendanceSuccess && attendance) {
    const title = isClockIn ? "Clocked in Successfully" : "Clocked out Successfully";
    const cardLabel = isClockIn ? "Session started" : "Total worked today";
    const cardValue = isClockIn
      ? formatAttendanceTime(attendance.sessionStartedAt)
      : formatWorkedMinutes(attendance.workedMinutes);

    return (
      <section className={cn(styles.resultPanel, styles.attendanceSuccess)} aria-live="polite">
        <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

        <div className={styles.successIcon} aria-hidden="true">
          <Check size={38} strokeWidth={2.4} />
        </div>

        <div className={styles.resultHeading}>
          <p className={styles.successEyebrow}>{formatAttendanceDate(attendance.occurredAt)}</p>
          <h1>{title}</h1>
          <div className={styles.attendanceTime}>{formatAttendanceTime(attendance.occurredAt)}</div>
        </div>

        <div className={styles.identitySummary}>
          <strong>{attendance.staffName}</strong>
          <span>
            <MapPin size={14} aria-hidden="true" />
            {attendance.branchName}
          </span>
          <em>{formatShiftLabel(attendance.shiftLabel)}</em>
        </div>

        <div className={styles.summaryCard}>
          <CalendarClock size={20} aria-hidden="true" />
          <div>
            <span>{cardLabel}</span>
            <strong>{cardValue}</strong>
          </div>
        </div>

        <div className={styles.securityNote}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{result.securityNote ?? "This device is recognized and ready for future scans."}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(styles.resultPanel, statusClass)} aria-live="polite">
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

      <div className={styles.genericResultIcon} aria-hidden="true">
        <ResultStatusIcon result={result} />
      </div>

      <div className={styles.genericResultCopy}>
        <p className={styles.eyebrow}>{getResultEyebrow(result)}</p>
        <h1>{resolution?.title ?? result.title}</h1>
        <p>{resolution?.staffMessage ?? result.message}</p>
        {resolution ? (
          <div className="mt-4 grid gap-2 text-left text-sm">
            <strong>{resolution.attendanceChanged ? "Attendance was changed." : "No attendance change was made."}</strong>
            {resolution.recommendedSteps.map((step) => <span key={step}>{step}</span>)}
            {resolution.crmActionRequired ? <span>CRM has been notified.</span> : null}
          </div>
        ) : result.detail ? <small>{result.detail}</small> : null}
      </div>

      {result.operationId ? (
        <details className="w-full rounded-xl border border-border/60 p-3 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold">Technical details</summary>
          <div className="mt-2">Safe code: {resolution?.safeErrorCode ?? result.reasonCode ?? "unknown"}</div>
          <div>Operation ID: {result.operationId}</div>
        </details>
      ) : null}

      {result.securityNote ? (
        <div className={styles.securityNote}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{result.securityNote}</span>
        </div>
      ) : null}

      {result.countdown ? (
        <div className={styles.serviceCard}>
          <div>
            <span>Active service</span>
            <strong>{result.countdown.serviceName}</strong>
            <small>
              {result.countdown.customerName}
              {result.countdown.resourceName ? ` · ${result.countdown.resourceName}` : ""}
            </small>
          </div>
          <div className={styles.countdownWrap}>
            <span>Remaining</span>
            <Countdown dueAt={result.countdown.dueAt} />
          </div>
        </div>
      ) : null}

      {!result.ok && result.reasonCode === "wrong_branch" && result.branchCorrection ? (
        <BranchCorrectionCard
          details={result.branchCorrection}
          state={branchCorrectionState}
          onRequest={onRequestBranchCorrection}
          onTryAnotherAccount={onTryAnotherAccount}
        />
      ) : null}
    </section>
  );
}
