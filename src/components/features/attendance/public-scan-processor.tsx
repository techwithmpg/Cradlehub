"use client";

import { useEffect, useRef, useState } from "react";
import {
  activateDeviceAction,
  completeFirstTimeAttendanceScanAction,
  processPublicQrScanAction,
  type FirstTimeScanFieldErrors,
} from "@/app/scan/actions";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
import { PublicScanLoginForm } from "./public-scan-login-form";
import { PublicScanResultView } from "./public-scan-result";
import { PublicScanStage, type PublicScanStageName } from "./public-scan-stage";
import styles from "./public-scan-processor.module.css";

type PublicScanProcessorProps =
  | { mode: "scan"; publicCode: string }
  | { mode: "activation"; token: string };

const RECOGNITION_DURATION_MS = 850;
const MINIMUM_FLOW_DURATION_MS = 1750;
const DEVICE_STAGE_DURATION_MS = 620;
const ATTENDANCE_STAGE_DURATION_MS = 760;

type ProcessorStage = PublicScanStageName | "sign_in_required" | "result";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function getShellTone(stage: ProcessorStage, result: PublicScanResult | null): string | undefined {
  if (stage === "device_registered") return styles.shellSuccess;
  if (stage !== "result" || !result) return styles.shellNeutral;
  if (result.ok && result.attendance) return styles.shellSuccess;
  if (!result.ok) return styles.shellBlocked;
  return styles.shellNeutral;
}

export function PublicScanProcessor(props: PublicScanProcessorProps) {
  const [stage, setStage] = useState<ProcessorStage>("recognizing");
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [loginCredentials, setLoginCredentials] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginFieldErrors, setLoginFieldErrors] = useState<FirstTimeScanFieldErrors | null>(null);
  const [requestId] = useState(() => createRequestId());
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const loginInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;
    const startedAt = Date.now();
    const processingTimer = window.setTimeout(() => {
      if (active) setStage("processing");
    }, RECOGNITION_DURATION_MS);

    async function runScan(): Promise<void> {
      let nextResult: PublicScanResult;

      try {
        nextResult =
          props.mode === "scan"
            ? await processPublicQrScanAction({ publicCode: props.publicCode, requestId })
            : await activateDeviceAction({ token: props.token, requestId });
      } catch {
        nextResult = {
          ok: false,
          outcome: "error",
          title: "Scan interrupted",
          message: "We could not complete this scan. Check your connection and scan the QR code again.",
        };
      }

      const remainingAnimationTime = MINIMUM_FLOW_DURATION_MS - (Date.now() - startedAt);
      if (remainingAnimationTime > 0) await wait(remainingAnimationTime);
      if (!active) return;

      if (props.mode === "scan" && nextResult.reasonCode === "unknown_device") {
        setResult(null);
        setLoginError(null);
        setLoginFieldErrors(null);
        setStage("sign_in_required");
        return;
      }

      setResult(nextResult);
      setStage("result");
    }

    void runScan();

    return () => {
      active = false;
      window.clearTimeout(processingTimer);
    };
  }, [props, requestId]);

  async function handleFirstTimeSignIn() {
    if (props.mode !== "scan" || loginInFlightRef.current) return;

    const email = loginCredentials.email.trim();
    const password = loginCredentials.password;
    loginInFlightRef.current = true;
    setLoginError(null);
    setLoginFieldErrors(null);
    setResult(null);
    setStage("signing_in");

    try {
      const actionResult = await completeFirstTimeAttendanceScanAction({
        publicCode: props.publicCode,
        email,
        password,
        requestId: createRequestId(),
      });

      if (!mountedRef.current) return;

      if (!actionResult.ok) {
        setLoginCredentials({ email, password: "" });

        if (actionResult.result) {
          setResult(actionResult.result);
          setStage("result");
          return;
        }

        setLoginError(actionResult.error ?? "Check your email and password, then try again.");
        setLoginFieldErrors(actionResult.fieldErrors ?? null);
        setStage("sign_in_required");
        return;
      }

      setLoginCredentials({ email, password: "" });
      setStage("registering_device");
      await wait(DEVICE_STAGE_DURATION_MS);
      if (!mountedRef.current) return;

      setStage("device_registered");
      await wait(DEVICE_STAGE_DURATION_MS);
      if (!mountedRef.current) return;

      setStage("processing_attendance");
      await wait(ATTENDANCE_STAGE_DURATION_MS);
      if (!mountedRef.current) return;

      setResult(actionResult.scan);
      setStage("result");
    } catch {
      if (!mountedRef.current) return;
      setLoginCredentials({ email, password: "" });
      setLoginError("Check your connection, then try signing in again.");
      setLoginFieldErrors(null);
      setStage("sign_in_required");
    } finally {
      loginInFlightRef.current = false;
    }
  }

  const shellTone = getShellTone(stage, result);

  return (
    <div className={cn(styles.shell, shellTone)}>
      {stage === "result" && result ? (
        <PublicScanResultView result={result} />
      ) : stage === "sign_in_required" && props.mode === "scan" ? (
        <PublicScanLoginForm
          email={loginCredentials.email}
          password={loginCredentials.password}
          error={loginError}
          fieldErrors={loginFieldErrors}
          onEmailChange={(email) => setLoginCredentials((current) => ({ ...current, email }))}
          onPasswordChange={(password) => setLoginCredentials((current) => ({ ...current, password }))}
          onSubmit={handleFirstTimeSignIn}
        />
      ) : (
        <PublicScanStage stage={stage === "result" || stage === "sign_in_required" ? "processing" : stage} />
      )}
    </div>
  );
}
