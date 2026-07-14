"use client";

import { useEffect, useRef, useState } from "react";
import {
  activateDeviceAction,
  requestBranchCorrectionAction,
  signInAndRegisterAttendanceDeviceAction,
  tryAnotherScanAccountAction,
  type FirstTimeScanFieldErrors,
} from "@/app/scan/actions";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
import type { BranchCorrectionScanDetails } from "@/lib/staff/branch-correction-types";
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

async function processPublicQrScan(input: { publicCode: string; requestId: string }): Promise<PublicScanResult> {
  const response = await fetch("/api/attendance/public-scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  let result: PublicScanResult | null = null;
  try {
    result = (await response.json()) as PublicScanResult;
  } catch {
    result = null;
  }

  if (result && typeof result.ok === "boolean" && typeof result.title === "string") {
    return result;
  }

  if (!response.ok) {
    throw new Error("Public scan request failed.");
  }

  throw new Error("Public scan response was invalid.");
}

function isMissingDeviceResult(result: PublicScanResult): boolean {
  const reasonCode = result.reasonCode?.toLowerCase();
  if (reasonCode === "unknown_device" || reasonCode === "missing_device" || reasonCode === "device_not_registered") {
    return true;
  }

  const title = result.title.toLowerCase();
  const message = result.message.toLowerCase();
  return (
    title.includes("device not registered") ||
    message.includes("activate this device before scanning") ||
    message.includes("not connected to a staff device record")
  );
}

function getShellTone(stage: ProcessorStage, result: PublicScanResult | null): string | undefined {
  if (stage === "device_registered") return styles.shellSuccess;
  if (stage !== "result" || !result) return styles.shellNeutral;
  if (result.ok && result.attendance) return styles.shellSuccess;
  if (!result.ok) return styles.shellBlocked;
  return styles.shellNeutral;
}

export function PublicScanProcessor(props: PublicScanProcessorProps) {
  const mode = props.mode;
  const scanPublicCode = mode === "scan" ? props.publicCode : null;
  const activationToken = mode === "activation" ? props.token : null;
  const [stage, setStage] = useState<ProcessorStage>("recognizing");
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [loginCredentials, setLoginCredentials] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginFieldErrors, setLoginFieldErrors] = useState<FirstTimeScanFieldErrors | null>(null);
  const [branchCorrectionState, setBranchCorrectionState] = useState<{
    status: "idle" | "pending" | "success" | "error";
    message: string | null;
  }>({ status: "idle", message: null });
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
          mode === "scan" && scanPublicCode
            ? await processPublicQrScan({ publicCode: scanPublicCode, requestId })
            : await activateDeviceAction({ token: activationToken ?? "", requestId });
      } catch {
        nextResult = {
          ok: false,
          outcome: "error",
          reasonCode: "UNKNOWN_ATTENDANCE_ERROR",
          title: "Scan interrupted",
          message: "We could not complete this scan. Check your connection and scan the QR code again.",
          detail: `Operation ID: ${requestId}`,
          operationId: requestId,
          securityNote: "No attendance change was confirmed from this attempt.",
        };
      }

      const remainingAnimationTime = MINIMUM_FLOW_DURATION_MS - (Date.now() - startedAt);
      if (remainingAnimationTime > 0) await wait(remainingAnimationTime);
      if (!active) return;

      if (mode === "scan" && isMissingDeviceResult(nextResult)) {
        setResult(null);
        setLoginError(null);
        setLoginFieldErrors(null);
        setBranchCorrectionState({ status: "idle", message: null });
        setStage("sign_in_required");
        return;
      }

      setResult(nextResult);
      setBranchCorrectionState({ status: "idle", message: null });
      setStage("result");
    }

    void runScan();

    return () => {
      active = false;
      window.clearTimeout(processingTimer);
    };
  }, [activationToken, mode, requestId, scanPublicCode]);

  async function handleFirstTimeSignIn() {
    if (mode !== "scan" || !scanPublicCode || loginInFlightRef.current) return;

    const email = loginCredentials.email.trim();
    const password = loginCredentials.password;
    loginInFlightRef.current = true;
    setLoginError(null);
    setLoginFieldErrors(null);
    setResult(null);
    setStage("signing_in");

    try {
      const actionResult = await signInAndRegisterAttendanceDeviceAction({
        publicCode: scanPublicCode,
        email,
        password,
        requestId,
      });

      if (!mountedRef.current) return;

      if (!actionResult.ok) {
        setLoginCredentials({ email, password: "" });

        if (actionResult.result) {
          setResult(actionResult.result);
          setBranchCorrectionState({ status: "idle", message: null });
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

      setResult(actionResult.result);
      setBranchCorrectionState({ status: "idle", message: null });
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

  async function handleBranchCorrectionRequest(details: BranchCorrectionScanDetails) {
    if (branchCorrectionState.status === "pending" || branchCorrectionState.status === "success") return;

    setBranchCorrectionState({ status: "pending", message: "Sending request..." });

    try {
      const actionResult = await requestBranchCorrectionAction({ details });
      if (!mountedRef.current) return;

      setBranchCorrectionState({
        status: actionResult.ok ? "success" : "error",
        message: actionResult.message,
      });
    } catch {
      if (!mountedRef.current) return;
      setBranchCorrectionState({
        status: "error",
        message: "We could not send this request. Please ask the front desk for help.",
      });
    }
  }

  async function handleTryAnotherAccount(details: BranchCorrectionScanDetails) {
    await tryAnotherScanAccountAction();
    const code = details.publicCode ?? scanPublicCode;
    if (code) {
      window.location.replace(`/scan/${encodeURIComponent(code)}?scan=${createRequestId()}`);
      return;
    }
    window.location.reload();
  }

  const shellTone = getShellTone(stage, result);

  return (
    <div className={cn(styles.shell, shellTone)}>
      {stage === "result" && result ? (
        <PublicScanResultView
          result={result}
          branchCorrectionState={branchCorrectionState}
          onRequestBranchCorrection={handleBranchCorrectionRequest}
          onTryAnotherAccount={handleTryAnotherAccount}
        />
      ) : stage === "sign_in_required" && mode === "scan" ? (
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
