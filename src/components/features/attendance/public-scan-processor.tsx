"use client";

import { useEffect, useRef, useState } from "react";
import {
  disconnectAttendancePhoneAction,
  activateDeviceAction,
  requestBranchCorrectionAction,
  signInAndRegisterAttendanceDeviceAction,
  switchScanAccountAction,
  type FirstTimeScanFieldErrors,
} from "@/app/scan/actions";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
import { withAttendanceScanResolution } from "@/lib/attendance/scan-resolution";
import { isStaffDeviceSignInReason } from "@/lib/attendance/staff-self-service";
import type { BranchCorrectionScanDetails } from "@/lib/staff/branch-correction-types";
import { PublicScanLoginForm } from "./public-scan-login-form";
import { PublicScanResultView } from "./public-scan-result";
import { PublicScanStage, type PublicScanStageName } from "./public-scan-stage";
import styles from "./public-scan-processor.module.css";
import {
  browserLocationFailureResult,
  freshAttendanceLocation,
  needsLocationExplanation,
  warmAttendanceLocation,
} from "@/lib/attendance/browser-location";
import type { AttendanceLocation } from "@/lib/attendance/geofence";

type PublicScanProcessorProps =
  | {
      mode: "scan";
      publicCode: string;
      scanBasePath?: "/scan" | "/staff/scan/process";
      locationRequired?: boolean;
    }
  | { mode: "activation"; token: string };

const RECOGNITION_DURATION_MS = 250;
const MINIMUM_FLOW_DURATION_MS = 450;
const DEVICE_STAGE_DURATION_MS = 350;
const ATTENDANCE_STAGE_DURATION_MS = 450;

type ProcessorStage = PublicScanStageName | "sign_in_required" | "location_permission" | "result";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function processPublicQrScan(input: {
  publicCode: string;
  requestId: string;
  location?: AttendanceLocation;
}): Promise<PublicScanResult> {
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
  if (isStaffDeviceSignInReason(result.reasonCode)) return true;

  const title = result.title.toLowerCase();
  const message = result.message.toLowerCase();
  return (
    title.includes("device not registered") ||
    title.includes("phone not connected") ||
    message.includes("activate this device before scanning") ||
    message.includes("not connected to a staff device record") ||
    message.includes("sign in again to reconnect")
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
  const [locationPromptAccepted, setLocationPromptAccepted] = useState(false);
  const locationRequired = mode === "scan" && props.locationRequired === true;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!locationRequired) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void warmAttendanceLocation();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [locationRequired]);

  useEffect(() => {
    if (startedRef.current) return;
    let active = true;
    let processingTimer: number | undefined;

    async function runScan(): Promise<void> {
      let nextResult: PublicScanResult;
      let location: AttendanceLocation | undefined;

      if (mode === "scan" && locationRequired) {
        const permission = await needsLocationExplanation();
        if (!active) return;
        if (permission === "denied") {
          setResult(
            withAttendanceScanResolution({
              ...browserLocationFailureResult("location_permission_denied"),
              operationId: requestId,
            })
          );
          setStage("result");
          return;
        }
        if (permission === "explain" && !locationPromptAccepted) {
          setStage("location_permission");
          return;
        }
        try {
          location = await freshAttendanceLocation();
        } catch (error) {
          if (!active) return;
          setResult(
            withAttendanceScanResolution({
              ...browserLocationFailureResult(error),
              operationId: requestId,
            })
          );
          setStage("result");
          return;
        }
      }
      if (!active) return;
      startedRef.current = true;
      const startedAt = Date.now();
      processingTimer = window.setTimeout(() => {
        if (active) setStage("processing");
      }, RECOGNITION_DURATION_MS);

      try {
        nextResult =
          mode === "scan" && scanPublicCode
            ? await processPublicQrScan({ publicCode: scanPublicCode, requestId, location })
            : await activateDeviceAction({ token: activationToken ?? "", requestId });
      } catch {
        nextResult = withAttendanceScanResolution({
          ok: false,
          outcome: "error",
          reasonCode: "network_error",
          title: "Internet connection interrupted",
          message: "Reconnect Wi-Fi or mobile data, then retry once from this same page.",
          detail: `Operation ID: ${requestId}`,
          operationId: requestId,
          securityNote: "No Attendance change was confirmed from this attempt.",
        });
      }

      const remainingAnimationTime = MINIMUM_FLOW_DURATION_MS - (Date.now() - startedAt);
      if (remainingAnimationTime > 0) await wait(remainingAnimationTime);
      if (!active) return;

      if (mode === "scan" && isMissingDeviceResult(nextResult)) {
        setResult(nextResult);
        setLoginError(null);
        setLoginFieldErrors(null);
        setBranchCorrectionState({ status: "idle", message: null });
        setStage("sign_in_required");
        return;
      }

      if (mode === "scan" && nextResult.deviceConnection === "auto_registered_from_session") {
        setStage("registering_device");
        await wait(DEVICE_STAGE_DURATION_MS);
        if (!active) return;

        setStage("device_registered");
        await wait(DEVICE_STAGE_DURATION_MS);
        if (!active) return;

        setStage("processing_attendance");
        await wait(ATTENDANCE_STAGE_DURATION_MS);
        if (!active) return;
      }
      setResult(nextResult);
      setBranchCorrectionState({ status: "idle", message: null });
      setStage("result");
    }

    void runScan();

    return () => {
      active = false;
      if (processingTimer !== undefined) window.clearTimeout(processingTimer);
    };
  }, [activationToken, mode, requestId, scanPublicCode, locationRequired, locationPromptAccepted]);

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
      let location: AttendanceLocation | undefined;
      if (locationRequired) {
        try {
          location = await freshAttendanceLocation();
        } catch (error) {
          if (mountedRef.current) {
            setResult(
              withAttendanceScanResolution({
                ...browserLocationFailureResult(error),
                operationId: requestId,
              })
            );
            setStage("result");
          }
          return;
        }
      }
      const actionResult = await signInAndRegisterAttendanceDeviceAction({
        publicCode: scanPublicCode,
        email,
        password,
        requestId,
        location,
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
    if (branchCorrectionState.status === "pending" || branchCorrectionState.status === "success")
      return;

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

  function restartScan() {
    if (scanPublicCode) {
      window.location.replace(
        `${props.mode === "scan" ? (props.scanBasePath ?? "/scan") : "/scan"}/${encodeURIComponent(scanPublicCode)}?scan=${createRequestId()}`
      );
      return;
    }
    window.location.reload();
  }

  async function handleSwitchAccount() {
    await switchScanAccountAction();
    restartScan();
  }

  async function handleDisconnectPhone() {
    await disconnectAttendancePhoneAction();
    restartScan();
  }

  const shellTone = getShellTone(stage, result);

  return (
    <div className={cn(styles.shell, shellTone)}>
      {stage === "result" && result ? (
        <PublicScanResultView
          result={result}
          branchCorrectionState={branchCorrectionState}
          onRequestBranchCorrection={handleBranchCorrectionRequest}
          onSwitchAccount={handleSwitchAccount}
          onDisconnectPhone={handleDisconnectPhone}
          onRetryLocation={locationRequired && [
            "location_permission_denied", "location_unavailable", "location_inaccurate",
            "location_invalid", "location_stale", "location_required", "location_outside",
          ].includes(result.reasonCode ?? "") ? restartScan : undefined}
        />
      ) : stage === "location_permission" ? (
        <section className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-5 p-8 text-center">
          <h1 className="text-xl font-semibold">Location access for attendance</h1>
          <p>
            CradleHub checks your location when you scan the branch attendance QR. Your phone will
            ask for location permission.
          </p>
          <button
            type="button"
            className="rounded-lg bg-[#31523d] px-5 py-3 font-semibold text-white"
            onClick={() => setLocationPromptAccepted(true)}
          >
            Allow location and continue
          </button>
        </section>
      ) : (stage === "sign_in_required" || stage === "signing_in") && mode === "scan" ? (
        <PublicScanLoginForm
          email={loginCredentials.email}
          password={loginCredentials.password}
          error={loginError}
          fieldErrors={loginFieldErrors}
          issueResult={result}
          requestId={requestId}
          pending={stage === "signing_in"}
          onEmailChange={(email) => setLoginCredentials((current) => ({ ...current, email }))}
          onPasswordChange={(password) =>
            setLoginCredentials((current) => ({ ...current, password }))
          }
          onSubmit={handleFirstTimeSignIn}
        />
      ) : (
        <PublicScanStage
          stage={stage === "result" || stage === "sign_in_required" ? "processing" : stage}
        />
      )}
    </div>
  );
}
