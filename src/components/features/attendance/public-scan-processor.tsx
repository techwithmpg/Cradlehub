"use client";

import { useEffect, useRef, useState } from "react";
import { activateDeviceAction, processPublicQrScanAction } from "@/app/scan/actions";
import { cn } from "@/lib/utils";
import type { PublicScanResult } from "@/lib/attendance/types";
import { PublicScanResultView } from "./public-scan-result";
import { PublicScanStage, type PublicScanStageName } from "./public-scan-stage";
import styles from "./public-scan-processor.module.css";

type PublicScanProcessorProps =
  | { mode: "scan"; publicCode: string }
  | { mode: "activation"; token: string };

const RECOGNITION_DURATION_MS = 850;
const MINIMUM_FLOW_DURATION_MS = 1750;

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function getShellTone(stage: PublicScanStageName | "result", result: PublicScanResult | null): string | undefined {
  if (stage !== "result" || !result) return styles.shellNeutral;
  if (result.ok && result.attendance) return styles.shellSuccess;
  if (!result.ok) return styles.shellBlocked;
  return styles.shellNeutral;
}

export function PublicScanProcessor(props: PublicScanProcessorProps) {
  const [stage, setStage] = useState<PublicScanStageName | "result">("recognizing");
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [requestId] = useState(() => createRequestId());
  const startedRef = useRef(false);

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

      setResult(nextResult);
      setStage("result");
    }

    void runScan();

    return () => {
      active = false;
      window.clearTimeout(processingTimer);
    };
  }, [props, requestId]);

  const shellTone = getShellTone(stage, result);

  return (
    <div className={cn(styles.shell, shellTone)}>
      {stage === "result" && result ? (
        <PublicScanResultView result={result} />
      ) : (
        <PublicScanStage stage={stage === "result" ? "processing" : stage} />
      )}
    </div>
  );
}
