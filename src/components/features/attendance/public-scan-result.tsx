"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleCheckBig,
  Clock3,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
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
};

function getResultStatusClass(result: PublicScanResult): string | undefined {
  if (result.outcome === "noop") return styles.resultInfo;
  return result.ok ? styles.resultSuccess : styles.resultBlocked;
}

function getResultEyebrow(result: PublicScanResult): string {
  if (result.outcome === "noop") return "No change needed";
  return result.ok ? "Scan accepted" : "Action needed";
}

function ResultStatusIcon({ result }: { result: PublicScanResult }) {
  if (result.outcome === "noop") return <Clock3 size={42} strokeWidth={1.8} />;
  if (result.ok) return <CircleCheckBig size={42} strokeWidth={1.8} />;
  return <AlertTriangle size={42} strokeWidth={1.8} />;
}

export function PublicScanResultView({ result }: PublicScanResultViewProps) {
  const attendance = result.attendance;
  const isClockIn = attendance?.action === "clock_in";
  const isAttendanceSuccess = result.ok && Boolean(attendance);
  const statusClass = getResultStatusClass(result);

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
          <span>This device is recognized and ready for future scans.</span>
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
        <h1>{result.title}</h1>
        <p>{result.message}</p>
        {result.detail ? <small>{result.detail}</small> : null}
      </div>

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
    </section>
  );
}
