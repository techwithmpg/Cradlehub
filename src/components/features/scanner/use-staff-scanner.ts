"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import jsQR from "jsqr";

export type ScannerState =
  | "permission_request"
  | "permission_denied"
  | "camera_unavailable"
  | "paused"
  | "scanning"
  | "code_detected"
  | "processing"
  | "rejected"
  | "invalid"
  | "duplicate"
  | "network_unknown";

export type UseStaffScannerOptions = {
  /** Raw transport only. The caller delegates normalization to the server. */
  onDecode: (raw: string, attemptId: string) => void;
  /**
   * If true, start scanning automatically on initial mount.
   */
  autoStart?: boolean;
};

export type UseStaffScannerReturn = {
  state: ScannerState;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  startScan: () => void;
  stopScan: () => void;
  scanAgain: () => void;
  setState: (s: ScannerState) => void;
  torchSupported: boolean;
  torchOn: boolean;
  toggleTorch: () => Promise<void>;
  flipCamera: () => void;
};

const CAMERA_STARTUP_TIMEOUT_MS = 12_000;

function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {
      // Ignore already-stopped track errors
    }
  }
}

function generateAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Camera capture and decoding with bulletproof mobile autoplay, StrictMode recovery, and torch support. */
export function useStaffScanner({
  onDecode,
  autoStart = false,
}: UseStaffScannerOptions): UseStaffScannerReturn {
  const [state, setState] = useState<ScannerState>("permission_request");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startupTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const acquiringRef = useRef(false);
  const facingModeRef = useRef<"environment" | "user">("environment");
  const onDecodeRef = useRef(onDecode);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const stopScan = useCallback(() => {
    generationRef.current += 1;
    acquiringRef.current = false;
    setTorchOn(false);
    setTorchSupported(false);
    if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.oncanplay = null;
      videoRef.current.srcObject = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!mountedRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("camera_unavailable");
      return;
    }
    if (acquiringRef.current) return;

    stopScan();
    const generation = generationRef.current;
    const isCurrent = () => mountedRef.current && generationRef.current === generation;
    lockedRef.current = false;
    acquiringRef.current = true;
    setState("permission_request");

    startupTimerRef.current = window.setTimeout(() => {
      if (!isCurrent()) return;
      stopScan();
      setState("camera_unavailable");
    }, CAMERA_STARTUP_TIMEOUT_MS);

    let stream: MediaStream | null = null;
    const preferredFacing = facingModeRef.current;

    try {
      // Progressive fallback chain so every iOS Safari, Android Chrome, and tablet camera opens reliably
      const constraintCandidates: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: { facingMode: preferredFacing },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let lastErr: unknown = null;
      for (const constraints of constraintCandidates) {
        if (!isCurrent()) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err) {
          lastErr = err;
          const errName = err && typeof err === "object" && "name" in err ? String(err.name) : "";
          // If the user explicitly denied permission, do not spam additional prompts
          if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
            throw err;
          }
        }
      }

      if (!stream) {
        throw lastErr ?? new Error("Could not acquire camera stream");
      }
    } catch (err) {
      if (!isCurrent()) return;
      stopScan();
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      setState(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "permission_denied"
          : "camera_unavailable"
      );
      return;
    }

    if (!isCurrent()) {
      stopStream(stream);
      return;
    }

    acquiringRef.current = false;
    streamRef.current = stream;

    // Detect hardware Torch / Flashlight capability if supported on mobile track
    try {
      const track = stream.getVideoTracks()[0];
      if (track && "getCapabilities" in track) {
        const caps = track.getCapabilities() as Record<string, unknown>;
        if (caps && caps.torch === true) {
          setTorchSupported(true);
        }
      }
    } catch {
      // Ignore torch capability errors
    }

    const video = videoRef.current;
    if (!video) {
      stopScan();
      setState("camera_unavailable");
      return;
    }

    function decoded(raw: string) {
      if (!isCurrent() || lockedRef.current) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      lockedRef.current = true;

      // Subtle tactile feedback on mobile devices when QR locks on
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([35, 30, 50]);
        }
      } catch {
        // Ignore vibration errors
      }

      setState("code_detected");
      const attemptId = generateAttemptId();
      // Allow 220ms for the emerald lock-on animation to flash before stopping the video feed
      window.setTimeout(() => {
        stopScan();
        onDecodeRef.current(trimmed, attemptId);
      }, 220);
    }

    function processFrame() {
      if (!isCurrent() || lockedRef.current) return;
      const canvas = canvasRef.current;
      if (
        video &&
        canvas &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        // Downscale high-res frames to max 640px width for 3x faster jsQR decoding on mobile CPUs
        const scale = Math.min(1, 640 / video.videoWidth);
        const w = Math.max(1, Math.floor(video.videoWidth * scale));
        const h = Math.max(1, Math.floor(video.videoHeight * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const frame = ctx.getImageData(0, 0, w, h);
          const qr = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: "attemptBoth",
          });
          if (qr && qr.data) {
            decoded(qr.data);
            return;
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    }

    let decoderStarted = false;
    function startDecoder() {
      if (!isCurrent() || decoderStarted) return;
      decoderStarted = true;
      if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
      setState("scanning");

      if ("BarcodeDetector" in window) {
        try {
          // @ts-expect-error - BarcodeDetector is not universally in lib.dom.d.ts.
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const detect = async () => {
            if (!isCurrent() || lockedRef.current) return;
            try {
              const barcodes = await detector.detect(video);
              if (!isCurrent() || lockedRef.current) return;
              if (barcodes.length && barcodes[0]?.rawValue) {
                decoded(String(barcodes[0].rawValue));
                return;
              }
            } catch {
              // Fall back to jsQR on next frame if native detector throws
              animFrameRef.current = requestAnimationFrame(processFrame);
              return;
            }
            if (isCurrent() && !lockedRef.current) {
              animFrameRef.current = requestAnimationFrame(detect);
            }
          };
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        } catch {
          // Native construction failed: use cross-browser jsQR path
        }
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    }

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.srcObject = stream;

    const tryPlay = () => {
      if (!isCurrent()) return;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(startDecoder).catch(() => {
          // Retry once after 150ms if mobile browser was still dismissing permission sheet
          window.setTimeout(() => {
            if (!isCurrent()) return;
            void video.play().then(startDecoder).catch(() => {
              if (isCurrent()) {
                stopScan();
                setState("camera_unavailable");
              }
            });
          }, 150);
        });
      } else {
        startDecoder();
      }
    };

    video.onloadedmetadata = tryPlay;
    video.oncanplay = tryPlay;
    if (video.readyState >= 1) {
      tryPlay();
    }
  }, [stopScan]);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Torch constraint not supported on this device
    }
  }, [torchOn]);

  const flipCamera = useCallback(() => {
    const nextMode = facingModeRef.current === "environment" ? "user" : "environment";
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);
    stopScan();
    void startScan();
  }, [startScan, stopScan]);

  const scanAgain = useCallback(() => {
    stopScan();
    void startScan();
  }, [startScan, stopScan]);

  // Mount & Visibility lifecycle — automatically starts on mount and cleanly resumes when returning to tab
  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) {
      void startScan();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Only stop if an active stream is running (do NOT kill while permission dialog is open!)
        if (streamRef.current !== null && !acquiringRef.current) {
          stopScan();
          setState("paused");
        }
      } else if (mountedRef.current && !lockedRef.current && !acquiringRef.current && !streamRef.current) {
        // Auto-resume camera when staff returns to the scanner screen
        void startScan();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopScan();
    };
  }, [autoStart, startScan, stopScan]);

  return {
    state,
    videoRef,
    canvasRef,
    startScan,
    stopScan,
    scanAgain,
    setState,
    torchSupported,
    torchOn,
    toggleTorch,
    flipCamera,
  };
}
