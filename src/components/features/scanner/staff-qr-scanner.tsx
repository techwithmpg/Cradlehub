"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useStaffScanner } from "./use-staff-scanner";
import type { ScannerState } from "./use-staff-scanner";
import { resolveStaffScanTargetAction } from "@/app/(dashboard)/staff/scan/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StaffQrScannerProps = {
  returnHref: string;
};

// ---------------------------------------------------------------------------
// Viewfinder sub-components
// ---------------------------------------------------------------------------

function CornerMarker({
  vertical,
  horizontal,
}: {
  vertical: "top" | "bottom";
  horizontal: "left" | "right";
}) {
  const v = vertical === "top" ? "top-3" : "bottom-3";
  const h = horizontal === "left" ? "left-3" : "right-3";
  return (
    <>
      <span aria-hidden="true" className={`absolute h-5 w-0.5 bg-[#163A2B] ${v} ${h}`} />
      <span aria-hidden="true" className={`absolute h-0.5 w-5 bg-[#163A2B] ${v} ${h}`} />
    </>
  );
}

function IdleOverlay({ state }: { state: ScannerState }) {
  if (state === "permission_request") {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#163A2B]/10">
          <Camera size={36} className="text-[#163A2B]" aria-hidden="true" />
        </span>
        <span className="px-4 text-center text-xs font-semibold text-[#1E293B]">
          Requesting camera access…
        </span>
      </div>
    );
  }
  if (state === "permission_denied") {
    return (
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <CameraOff size={36} className="text-red-500" aria-hidden="true" />
      </span>
    );
  }
  if (state === "camera_unavailable") {
    return (
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
        <CameraOff size={36} className="text-amber-600" aria-hidden="true" />
      </span>
    );
  }
  if (state === "invalid" || state === "rejected") {
    return <XCircle size={48} className="text-red-400" aria-hidden="true" />;
  }
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#163A2B]/10">
      <QrCode size={36} className="text-[#163A2B]" aria-hidden="true" />
    </span>
  );
}

function Viewfinder({
  state,
  videoRef,
  canvasRef,
}: {
  state: ScannerState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const liveStates: ScannerState[] = ["scanning", "code_detected", "processing"];
  const isLive = liveStates.includes(state);

  const borderColor =
    state === "invalid" || state === "rejected"
        ? "border-red-400"
        : "border-[#C8A96B]";

  return (
    <div
      className={`relative mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-3xl border-2 ${borderColor} shadow-sm transition-colors duration-300`}
      role="img"
      aria-label="QR code viewfinder"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${isLive ? "opacity-100" : "opacity-0"}`}
        playsInline
        muted
        autoPlay={false}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{ left: -9999, top: -9999, width: 1, height: 1 }}
        aria-hidden="true"
      />

      <CornerMarker vertical="top" horizontal="left" />
      <CornerMarker vertical="top" horizontal="right" />
      <CornerMarker vertical="bottom" horizontal="left" />
      <CornerMarker vertical="bottom" horizontal="right" />

      {/* Scan-line while active */}
      {state === "scanning" && (
        <div
          aria-hidden="true"
          className="absolute inset-x-4 h-px animate-bounce bg-gradient-to-r from-transparent via-[#C8A96B] to-transparent"
          style={{ animationDuration: "1.8s" }}
        />
      )}

      {/* Processing spinner */}
      {(state === "code_detected" || state === "processing") && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Loader2 size={44} className="animate-spin text-white" aria-hidden="true" />
        </div>
      )}

      {/* Idle / error overlay */}
      {!isLive && (
        <div className="flex flex-col items-center gap-3">
          <IdleOverlay state={state} />
        </div>
      )}
    </div>
  );
}

function StatusMessage({ state }: { state: ScannerState }) {
  if (state === "permission_request") {
    return (
      <p className="text-center text-sm font-medium text-[#475569]">
        Starting camera…
      </p>
    );
  }
  if (state === "scanning") {
    return (
      <p className="text-center text-sm font-medium text-[#163A2B]">
        Hold steady over the QR code…
      </p>
    );
  }
  if (state === "code_detected" || state === "processing") {
    return (
      <p className="text-center text-sm font-medium text-[#475569]">
        Code detected — processing…
      </p>
    );
  }
  if (state === "paused") {
    return <p className="text-center text-sm text-[#475569]">Camera paused. Tap Scan again to resume.</p>;
  }
  if (state === "permission_denied") {
    return (
      <div className="rounded-2xl border border-[#EAE4DC] bg-white p-4 shadow-xs" role="alert">
        <div className="flex items-start gap-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#C8A96B]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">Camera access required</p>
            <p className="mt-1 text-xs leading-relaxed text-[#475569]">
              Allow camera access in your browser or device settings, then tap{" "}
              <strong>Try again</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (state === "camera_unavailable") {
    return (
      <div className="rounded-2xl border border-[#EAE4DC] bg-white p-4 shadow-xs" role="alert">
        <p className="text-sm font-semibold text-[#1E293B]">Camera unavailable</p>
        <p className="mt-1 text-xs leading-relaxed text-[#475569]">
          Check that no other app is using the camera, then tap <strong>Try again</strong>.
        </p>
      </div>
    );
  }
  if (state === "invalid" || state === "rejected") {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-xs" role="alert">
        <p className="text-sm font-semibold text-red-700">
          {state === "invalid" ? "Invalid QR code" : "Code not recognized"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#475569]">
          {state === "invalid"
            ? "This code is not supported. Scan a CradleHub attendance or booking QR code."
            : "This QR code is not a valid CradleHub code. Tap Scan again to retry."}
        </p>
      </div>
    );
  }
  if (state === "network_unknown") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="alert">
        <p className="text-sm font-semibold text-amber-900">Network error</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Could not reach the server. Check your connection and tap <strong>Scan again</strong>.
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-sm text-[#475569]">
      Point your camera at a CradleHub QR code
    </p>
  );
}

function Actions({
  state,
  onScanAgain,
  returnHref,
}: {
  state: ScannerState;
  onScanAgain: () => void;
  returnHref: string;
}) {
  const inProgress =
    state === "permission_request" ||
    state === "scanning" ||
    state === "code_detected" ||
    state === "processing";

  if (inProgress) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#163A2B]/10 px-4 py-2 text-xs font-semibold text-[#163A2B]">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {state === "permission_request"
              ? "Starting camera…"
              : state === "scanning"
              ? "Scanning in progress"
              : "Processing code…"}
          </div>
        </div>
        <a
          id="staff-scanner-return"
          href={returnHref}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#EAE4DC] bg-white text-sm font-semibold text-[#163A2B] shadow-xs transition hover:bg-[#F7F3EB] active:scale-95"
        >
          Return to Workspace
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        id="staff-scanner-start"
        type="button"
        onClick={onScanAgain}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#163A2B] text-sm font-semibold text-white shadow-xs transition hover:bg-[#10261D] active:scale-95"
      >
        <RefreshCw size={16} aria-hidden="true" />
        {state === "permission_denied" ? "Try again" : "Scan again"}
      </button>

      <a
        id="staff-scanner-return"
        href={returnHref}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#EAE4DC] bg-white text-sm font-semibold text-[#163A2B] shadow-xs transition hover:bg-[#F7F3EB] active:scale-95"
      >
        Return to Workspace
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * StaffQrScanner — full-page camera QR scanner for the Staff PWA.
 *
 * Single responsibility: camera lifecycle + decode + delegate to server-owned
 * adapter routes via Next.js router. No mutations performed here.
 *
 * The `setState` setter from the hook is accessed via a stable ref to avoid
 * the circular dependency that would arise from passing it to the hook via
 * the handleDecode callback.
 *
 * Architecture: PWA-GOV-009 / C6
 */
export function StaffQrScanner({ returnHref }: StaffQrScannerProps) {
  const router = useRouter();

  /**
   * Stable ref to the hook's setState function.
   * Populated synchronously after the hook call; safe to access in
   * handleDecode which is only invoked asynchronously (after decode).
   */
  const setStateRef = useRef<((s: ScannerState) => void) | null>(null);

  const requestRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestRef.current = null; };
  }, []);

  const handleDecode = useCallback(
    async (raw: string, attemptId: string) => {
      const setState = setStateRef.current;
      if (!setState) return;
      requestRef.current = attemptId;
      setState("processing");
      try {
        const result = await resolveStaffScanTargetAction(raw);
        if (!mountedRef.current || requestRef.current !== attemptId) return;
        if (!result.ok) {
          setState("invalid");
          return;
        }
        // A normalized transport is not an operation result. Remain processing.
        if (result.target === "public_scan") {
          router.push(`/staff/scan/process/${encodeURIComponent(result.publicCode)}`);
        } else {
          router.push(`/staff/scan/activate/${encodeURIComponent(result.token)}`);
        }
      } catch {
        if (mountedRef.current && requestRef.current === attemptId) setState("network_unknown");
      }
    },
    [router]
  );

  const { state, videoRef, canvasRef, scanAgain, setState } =
    useStaffScanner({ onDecode: handleDecode, autoStart: true });

  // Keep the ref current after each render
  setStateRef.current = setState;

  return (
    <div className="flex flex-col gap-5 py-4">
      <Viewfinder state={state} videoRef={videoRef} canvasRef={canvasRef} />
      <StatusMessage state={state} />
      <Actions
        state={state}
        onScanAgain={scanAgain}
        returnHref={returnHref}
      />
      <p className="mt-auto text-center text-[11px] text-[#64748B]">
        🔒 Camera active only while scanning · Camera images are not saved
      </p>
    </div>
  );
}
