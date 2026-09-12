"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import jsQR from "jsqr";
import { resolveStaffScanTarget } from "@/lib/scanner/resolve-scan-target";
import type { ScanTargetResult } from "@/lib/scanner/resolve-scan-target";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScannerState =
  | "permission_request"
  | "permission_denied"
  | "camera_unavailable"
  | "scanning"
  | "code_detected"
  | "processing"
  | "confirmed"
  | "rejected"
  | "invalid"
  | "duplicate"
  | "network_unknown";

export type UseStaffScannerOptions = {
  /**
   * Called once with a resolved target after the decoder locks.
   * The caller is responsible for delegation to the appropriate handler.
   */
  onTarget: (result: ScanTargetResult, attemptId: string) => void;
};

export type UseStaffScannerReturn = {
  /** Current scanner lifecycle state */
  state: ScannerState;
  /** Ref to attach to the <video> element */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Ref to attach to the offscreen <canvas> element */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Start camera / begin scanning */
  startScan: () => void;
  /** Stop camera and release all tracks */
  stopScan: () => void;
  /** Reset to permission_request and allow the user to try again */
  scanAgain: () => void;
  /** Advance state externally (e.g. after server result arrives) */
  setState: (s: ScannerState) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function generateAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the full camera lifecycle and QR decoding for the Staff PWA scanner.
 *
 * Frame-reading strategy:
 *   1. Feature-detect BarcodeDetector (native hardware path on Chromium Android).
 *   2. Fall back to jsQR (pure-JS, covers iPhone Safari PWA and all browsers).
 *
 * Track teardown fires on: decode-lock, close, unmount, document.hidden.
 * A BarcodeDetector object is never instantiated unless the API is present.
 */
export function useStaffScanner(
  options: UseStaffScannerOptions
): UseStaffScannerReturn {
  const { onTarget } = options;

  const [state, setState] = useState<ScannerState>("permission_request");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);

  // Keep a stable reference to onTarget to avoid re-triggering effects
  const onTargetRef = useRef(onTarget);
  useEffect(() => {
    onTargetRef.current = onTarget;
  }, [onTarget]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  // Stop camera when document is hidden (tab switch, home button)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        // Do not stop the stream on visibility hide — allow resume on focus
        // If the user leaves for extended time the OS will reclaim the camera
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const stopScan = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const processFrame = useCallback(() => {
    if (lockedRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const { videoWidth, videoHeight } = video;
    if (videoWidth === 0 || videoHeight === 0) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);

    // Try jsQR fallback (covers Safari/iOS)
    const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (qrResult) {
      // Lock immediately — exactly one submission
      lockedRef.current = true;
      if (mountedRef.current) {
        setState("code_detected");
      }
      // Stop camera tracks
      stopStream(streamRef.current);
      streamRef.current = null;

      const payload = qrResult.data;
      const target = resolveStaffScanTarget(payload);
      const attemptId = generateAttemptId();

      if (mountedRef.current) {
        setState("processing");
        onTargetRef.current(target, attemptId);
      }
      return;
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  const startScan = useCallback(async () => {
    if (!mountedRef.current) return;

    lockedRef.current = false;
    setState("permission_request");

    // Try native BarcodeDetector if available (Chromium Android optimization)
    const hasBarcodeDetector =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window;

    let stream: MediaStream | null = null;

    try {
      // Prefer environment (rear) camera; graceful fallback
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState("permission_denied");
      } else {
        setState("camera_unavailable");
      }
      return;
    }

    if (!mountedRef.current) {
      stopStream(stream);
      return;
    }

    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      stopStream(stream);
      if (mountedRef.current) setState("camera_unavailable");
      return;
    }

    video.srcObject = stream;

    // Wait for metadata before starting frame loop
    video.onloadedmetadata = () => {
      if (!mountedRef.current) return;
      void video.play().then(() => {
        if (!mountedRef.current) return;

        if (hasBarcodeDetector) {
          // Use native BarcodeDetector (optimization only; jsQR is the fallback)
          void startNativeBarcodeDetector(stream!, video);
        } else {
          setState("scanning");
          animFrameRef.current = requestAnimationFrame(processFrame);
        }
      }).catch(() => {
        if (mountedRef.current) setState("camera_unavailable");
      });
    };
  }, [processFrame]);

  // Native BarcodeDetector path (Chromium Android, no canvas loop needed)
  const startNativeBarcodeDetector = useCallback(async (
    stream: MediaStream,
    video: HTMLVideoElement,
  ) => {
    if (!mountedRef.current) return;
    setState("scanning");

    try {
      // @ts-expect-error - BarcodeDetector is experimental, not in lib.dom.d.ts universally
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

      const detect = async () => {
        if (lockedRef.current || !mountedRef.current) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0 && !lockedRef.current) {
            lockedRef.current = true;
            setState("code_detected");
            stopStream(stream);
            streamRef.current = null;

            const payload = barcodes[0].rawValue as string;
            const target = resolveStaffScanTarget(payload);
            const attemptId = generateAttemptId();

            if (mountedRef.current) {
              setState("processing");
              onTargetRef.current(target, attemptId);
            }
            return;
          }
        } catch {
          // BarcodeDetector can throw on some frames; fall through to next frame
        }

        if (!lockedRef.current && mountedRef.current) {
          animFrameRef.current = requestAnimationFrame(detect);
        }
      };

      animFrameRef.current = requestAnimationFrame(detect);
    } catch {
      // BarcodeDetector instantiation failed; fall back to jsQR
      if (mountedRef.current) {
        animFrameRef.current = requestAnimationFrame(processFrame);
      }
    }
  }, [processFrame]);

  const scanAgain = useCallback(() => {
    stopScan();
    lockedRef.current = false;
    if (mountedRef.current) {
      setState("permission_request");
    }
    void startScan();
  }, [startScan, stopScan]);

  return {
    state,
    videoRef,
    canvasRef,
    startScan,
    stopScan,
    scanAgain,
    setState,
  };
}
