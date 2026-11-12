"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  SwitchCamera,
  XCircle,
} from "lucide-react";
import { useStaffScanner } from "./use-staff-scanner";
import type { ScannerState } from "./use-staff-scanner";
import { resolveStaffScanTargetAction } from "@/app/(dashboard)/staff/scan/actions";
import { useStaffScanLocation } from "./use-staff-scan-location";

type StaffQrScannerProps = {
  returnHref: string;
  locationRequired?: boolean;
};

function CornerReticle({
  vertical,
  horizontal,
  locked,
  error,
}: {
  vertical: "top" | "bottom";
  horizontal: "left" | "right";
  locked: boolean;
  error: boolean;
}) {
  const v = vertical === "top" ? "top-5" : "bottom-5";
  const h = horizontal === "left" ? "left-5" : "right-5";
  const rounded =
    vertical === "top" && horizontal === "left"
      ? "rounded-tl-2xl border-t-[3px] border-l-[3px]"
      : vertical === "top" && horizontal === "right"
        ? "rounded-tr-2xl border-t-[3px] border-r-[3px]"
        : vertical === "bottom" && horizontal === "left"
          ? "rounded-bl-2xl border-b-[3px] border-l-[3px]"
          : "rounded-br-2xl border-b-[3px] border-r-[3px]";

  const colorClass = error
    ? "border-red-400 shadow-[0_0_16px_rgba(248,113,113,0.5)]"
    : locked
      ? "border-emerald-400 scale-95 shadow-[0_0_24px_rgba(52,211,153,0.85)]"
      : "border-[#E8C781] shadow-[0_0_14px_rgba(232,199,129,0.45)]";

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-9 w-9 transition-all duration-300 ${v} ${h} ${rounded} ${colorClass}`}
    />
  );
}

function IdleOverlay({ state }: { state: ScannerState }) {
  if (state === "permission_request") {
    return (
      <div className="flex flex-col items-center gap-3.5">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-[#E8C781]/30 bg-white/10 backdrop-blur-md">
          <span className="absolute inset-0 animate-ping rounded-3xl bg-[#E8C781]/15" />
          <Camera size={36} className="text-[#E8C781]" aria-hidden="true" />
        </div>
        <span className="px-4 text-center text-xs font-semibold tracking-wide text-white/90">
          Opening camera lens…
        </span>
      </div>
    );
  }
  if (state === "permission_denied") {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-400/30 bg-red-500/15 backdrop-blur-md">
        <CameraOff size={38} className="text-red-300" aria-hidden="true" />
      </span>
    );
  }
  if (state === "camera_unavailable") {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-400/30 bg-amber-500/15 backdrop-blur-md">
        <CameraOff size={38} className="text-amber-300" aria-hidden="true" />
      </span>
    );
  }
  if (state === "invalid" || state === "rejected") {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-400/40 bg-red-500/20 backdrop-blur-md">
        <XCircle size={44} className="text-red-300" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[#E8C781]/30 bg-white/10 backdrop-blur-md">
      <QrCode size={38} className="text-[#E8C781]" aria-hidden="true" />
    </span>
  );
}

function Viewfinder({
  state,
  videoRef,
  canvasRef,
  torchSupported,
  torchOn,
  onToggleTorch,
  onFlipCamera,
}: {
  state: ScannerState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
  onFlipCamera: () => void;
}) {
  const liveStates: ScannerState[] = ["scanning", "code_detected", "processing"];
  const isLive = liveStates.includes(state);
  const isLocked = state === "code_detected" || state === "processing";
  const isError = state === "invalid" || state === "rejected";

  const borderColor = isError
    ? "border-red-400 shadow-[0_20px_50px_rgba(239,68,68,0.25)]"
    : isLocked
      ? "border-emerald-400 shadow-[0_20px_50px_rgba(16,185,129,0.35)]"
      : "border-[#C8A96B]/80 shadow-[0_20px_50px_rgba(10,35,22,0.3)]";

  return (
    <div
      className={`relative mx-auto flex h-[min(54dvh,420px)] w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[28px] border-2 bg-[radial-gradient(circle_at_center,#254432,#0c1f17_78%)] ${borderColor} transition-all duration-300`}
      role="img"
      aria-label="QR code viewfinder"
    >
      {/* Inline Keyframes for Smooth HUD Laser & Target Pulse */}
      <style>{`
        @keyframes chLaserSweep {
          0% { top: 12%; opacity: 0.35; }
          50% { top: 86%; opacity: 1; }
          100% { top: 12%; opacity: 0.35; }
        }
        @keyframes chReticlePulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.03); opacity: 0.9; }
        }
      `}</style>

      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          isLive ? "opacity-100" : "opacity-0"
        }`}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute opacity-0"
        style={{ left: -9999, top: -9999, width: 1, height: 1 }}
        aria-hidden="true"
      />

      {/* Subtle Vignette + Cyber Grid Overlay when scanning */}
      {isLive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(6,20,14,0.62)_100%)]"
        />
      )}

      {/* Top HUD Live Pill & Camera Controls */}
      {isLive && (
        <div className="absolute top-3.5 inset-x-4 z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            <span
              className={`h-2 w-2 rounded-full ${
                isLocked ? "bg-emerald-400 animate-ping" : "bg-[#E8C781] animate-pulse"
              }`}
            />
            {isLocked ? "QR Locked" : "HD Scanner Active"}
          </div>
          <div className="flex items-center gap-1.5">
            {torchSupported && (
              <button
                type="button"
                onClick={onToggleTorch}
                aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition ${
                  torchOn
                    ? "border-[#E8C781] bg-[#E8C781] text-[#10271e]"
                    : "border-white/20 bg-black/45 text-white hover:bg-black/65"
                }`}
              >
                <Flashlight size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onFlipCamera}
              aria-label="Switch camera"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
            >
              <SwitchCamera size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Inner Target Box with Breathing Reticle */}
      <div
        aria-hidden="true"
        className={`pointer-events-none relative h-[68%] w-[72%] rounded-2xl border transition-all duration-300 ${
          isLocked
            ? "scale-95 border-emerald-400/80 bg-emerald-400/10"
            : "border-white/15 bg-white/[0.02]"
        }`}
        style={state === "scanning" ? { animation: "chReticlePulse 2.4s ease-in-out infinite" } : undefined}
      >
        <CornerReticle vertical="top" horizontal="left" locked={isLocked} error={isError} />
        <CornerReticle vertical="top" horizontal="right" locked={isLocked} error={isError} />
        <CornerReticle vertical="bottom" horizontal="left" locked={isLocked} error={isError} />
        <CornerReticle vertical="bottom" horizontal="right" locked={isLocked} error={isError} />

        {/* Sweeping Laser Line + Glow Trail */}
        {state === "scanning" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#E8C781] to-transparent shadow-[0_0_18px_3px_rgba(232,199,129,0.85)]"
            style={{ animation: "chLaserSweep 2.2s ease-in-out infinite" }}
          />
        )}
      </div>

      {/* Lock-On / Processing Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-emerald-950/45 backdrop-blur-[2px] transition-opacity duration-200">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500/25 shadow-[0_0_30px_rgba(16,185,129,0.6)]">
            {state === "code_detected" ? (
              <CheckCircle2 size={36} className="text-emerald-300 animate-bounce" aria-hidden="true" />
            ) : (
              <Loader2 size={34} className="animate-spin text-emerald-200" aria-hidden="true" />
            )}
          </div>
          <span className="rounded-full bg-black/55 px-3.5 py-1 text-xs font-bold tracking-wide text-emerald-200 backdrop-blur-md">
            {state === "code_detected" ? "QR Code Locked!" : "Verifying Pass…"}
          </span>
        </div>
      )}

      {/* Idle / Error Overlay */}
      {!isLive && (
        <div className="z-10 flex flex-col items-center gap-3">
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
        Starting camera… If prompted by your phone, tap <strong>Allow</strong>.
      </p>
    );
  }
  if (state === "scanning") {
    return (
      <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-[#163A2B]">
        <Sparkles size={15} className="text-[#C8A96B]" />
        Align the branch or room QR code inside the frame
      </p>
    );
  }
  if (state === "code_detected" || state === "processing") {
    return (
      <p className="text-center text-sm font-semibold text-emerald-800">
        QR recognized — updating your shift now…
      </p>
    );
  }
  if (state === "paused") {
    return (
      <p className="text-center text-sm text-[#475569]">
        Camera paused. Tap <strong>Resume Camera</strong> below to scan.
      </p>
    );
  }
  if (state === "permission_denied") {
    return (
      <div className="rounded-2xl border border-[#EAE4DC] bg-white p-4 shadow-xs" role="alert">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#C8A96B]" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-[#1E293B]">Camera permission needed</p>
            <p className="mt-1 text-xs leading-relaxed text-[#475569]">
              Tap the lock or camera icon in your browser address bar, set Camera to{" "}
              <strong>Allow</strong>, then tap <strong>Open Camera</strong> below.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (state === "camera_unavailable") {
    return (
      <div className="rounded-2xl border border-[#EAE4DC] bg-white p-4 shadow-xs" role="alert">
        <p className="text-sm font-bold text-[#1E293B]">Camera didn't start in time</p>
        <p className="mt-1 text-xs leading-relaxed text-[#475569]">
          Make sure no other app is using your camera, then tap <strong>Open Camera</strong> below.
          (Tip: You can also scan the wall QR directly with your phone's built-in Camera app!)
        </p>
      </div>
    );
  }
  if (state === "invalid" || state === "rejected") {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-xs" role="alert">
        <p className="text-sm font-bold text-red-700">
          {state === "invalid" ? "Unrecognized QR code" : "Code not recognized"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#475569]">
          Please scan the official CradleHub Attendance or Room QR poster.
        </p>
      </div>
    );
  }
  if (state === "network_unknown") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="alert">
        <p className="text-sm font-bold text-amber-900">Connection hiccup</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Could not reach CradleHub. Check your Wi-Fi or mobile data and tap{" "}
          <strong>Scan again</strong>.
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-sm text-[#475569]">Point your camera at a CradleHub QR code</p>
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
    state === "scanning" || state === "code_detected" || state === "processing";

  if (inProgress) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#163A2B]/10 px-4 py-2 text-xs font-semibold text-[#163A2B]">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {state === "scanning" ? "Ready — waiting for QR code" : "Processing scan…"}
          </div>
        </div>
        <a
          id="staff-scanner-return"
          href={returnHref}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#EAE4DC] bg-white text-sm font-semibold text-[#163A2B] shadow-xs transition hover:bg-[#F7F3EB] active:scale-95"
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
        {state === "permission_denied" || state === "camera_unavailable" || state === "permission_request"
          ? "Open Camera"
          : state === "paused"
            ? "Resume Camera"
            : "Scan again"}
      </button>

      <a
        id="staff-scanner-return"
        href={returnHref}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#EAE4DC] bg-white text-sm font-semibold text-[#163A2B] shadow-xs transition hover:bg-[#F7F3EB] active:scale-95"
      >
        Return to Workspace
      </a>
    </div>
  );
}

export function StaffQrScanner({ returnHref, locationRequired = false }: StaffQrScannerProps) {
  useStaffScanLocation(locationRequired);
  const router = useRouter();

  const setStateRef = useRef<((s: ScannerState) => void) | null>(null);
  const requestRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current = null;
    };
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
        if (result.target === "public_scan") {
          router.push(`/staff/scan/process/${encodeURIComponent(result.publicCode)}`);
        } else {
          router.push(`/staff/scan/activate/${encodeURIComponent(result.token)}`);
        }
      } catch {
        if (mountedRef.current && requestRef.current !== attemptId) return;
        if (mountedRef.current) setState("network_unknown");
      }
    },
    [router]
  );

  const {
    state,
    videoRef,
    canvasRef,
    scanAgain,
    setState,
    torchSupported,
    torchOn,
    toggleTorch,
    flipCamera,
  } = useStaffScanner({
    onDecode: handleDecode,
    autoStart: true,
  });

  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  return (
    <div className="flex flex-col gap-5 py-3">
      <Viewfinder
        state={state}
        videoRef={videoRef}
        canvasRef={canvasRef}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={() => void toggleTorch()}
        onFlipCamera={flipCamera}
      />
      <StatusMessage state={state} />
      <Actions state={state} onScanAgain={scanAgain} returnHref={returnHref} />
      <p className="mt-auto text-center text-[11px] text-[#64748B]">
        🔒 Camera active only while scanning · Images are never stored
      </p>
    </div>
  );
}
