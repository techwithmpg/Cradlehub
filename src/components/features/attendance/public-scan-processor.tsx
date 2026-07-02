"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { activateDeviceAction, processPublicQrScanAction } from "@/app/scan/actions";
import type { PublicScanResult } from "@/lib/attendance/types";

type PublicScanProcessorProps =
  | { mode: "scan"; publicCode: string }
  | { mode: "activation"; token: string };

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

  return (
    <div
      style={{
        marginTop: "1rem",
        borderTop: "1px solid rgba(15, 23, 42, 0.12)",
        paddingTop: "1rem",
      }}
    >
      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.25rem" }}>
        Session remaining
      </div>
      <div
        style={{
          fontSize: "2.5rem",
          lineHeight: 1,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: remaining <= 0 ? "#B42318" : "#0f172a",
        }}
      >
        {formatRemaining(remaining)}
      </div>
    </div>
  );
}

export function PublicScanProcessor(props: PublicScanProcessorProps) {
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [requestId] = useState(() => createRequestId());
  const [isPending, startTransition] = useTransition();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    startTransition(async () => {
      const nextResult =
        props.mode === "scan"
          ? await processPublicQrScanAction({ publicCode: props.publicCode, requestId })
          : await activateDeviceAction({ token: props.token, requestId });
      setResult(nextResult);
    });
  }, [props, requestId]);

  const tone = result?.ok ? "#047857" : result?.outcome === "noop" ? "#0369a1" : "#B42318";
  const border = result?.ok ? "rgba(4, 120, 87, 0.2)" : result?.outcome === "noop" ? "rgba(3, 105, 161, 0.2)" : "rgba(180, 35, 24, 0.2)";

  return (
    <div
      style={{
        width: "min(100%, 420px)",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: "#ffffff",
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
        padding: "1.25rem",
      }}
    >
      {!result || isPending ? (
        <>
          <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Processing scan
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
            Please wait...
          </div>
        </>
      ) : (
        <>
          <div style={{ color: tone, fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            {result.ok ? "Accepted" : result.outcome === "noop" ? "No change" : "Action needed"}
          </div>
          <div style={{ fontSize: "1.45rem", lineHeight: 1.15, fontWeight: 700, color: "#0f172a" }}>
            {result.title}
          </div>
          <p style={{ color: "#334155", marginTop: "0.75rem", lineHeight: 1.5 }}>
            {result.message}
          </p>
          {result.detail ? (
            <p style={{ color: "#64748b", marginTop: "0.5rem", fontSize: "0.9rem", lineHeight: 1.45 }}>
              {result.detail}
            </p>
          ) : null}
          {result.countdown ? (
            <>
              <div style={{ marginTop: "1rem", color: "#334155", fontSize: "0.9rem", lineHeight: 1.5 }}>
                <strong>{result.countdown.serviceName}</strong>
                <br />
                {result.countdown.customerName}
                {result.countdown.resourceName ? ` - ${result.countdown.resourceName}` : ""}
              </div>
              <Countdown dueAt={result.countdown.dueAt} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
