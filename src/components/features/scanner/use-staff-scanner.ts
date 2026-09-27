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
   * Resuming after pause/hide or error never auto-starts.
   * Defaults to false so callers can control lifecycle explicitly.
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
};

function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

function generateAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Camera capture and decoding only; no transport classification or mutations. */
export function useStaffScanner({ onDecode, autoStart = false }: UseStaffScannerOptions): UseStaffScannerReturn {
  const [state, setState] = useState<ScannerState>("permission_request");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const acquiringRef = useRef(false);
  const autoStartedRef = useRef(false);
  const onDecodeRef = useRef(onDecode);
  useEffect(() => { onDecodeRef.current = onDecode; }, [onDecode]);

  const stopScan = useCallback(() => {
    // Invalidate pending permission, play and native decoder promises as well as RAF.
    generationRef.current += 1;
    acquiringRef.current = false;
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    function handleVisibilityChange() {
      if (!document.hidden) return; // Resuming always requires a deliberate action.
      const wasCapturing = acquiringRef.current || streamRef.current !== null;
      stopScan();
      if (wasCapturing) setState("paused");
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopScan();
    };
  }, [stopScan]);

  const startScan = useCallback(async () => {
    if (!mountedRef.current || document.hidden || acquiringRef.current || streamRef.current) return;
    stopScan();
    const generation = generationRef.current;
    const isCurrent = () => mountedRef.current && !document.hidden && generationRef.current === generation;
    lockedRef.current = false;
    acquiringRef.current = true;
    setState("permission_request");

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
      } catch {
        if (!isCurrent()) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    } catch (err) {
      if (!isCurrent()) return;
      acquiringRef.current = false;
      const name = err && typeof err === "object" && "name" in err ? err.name : "";
      setState(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "permission_denied" : "camera_unavailable");
      return;
    }
    if (!isCurrent()) { stopStream(stream); return; }
    acquiringRef.current = false;
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) { stopScan(); setState("camera_unavailable"); return; }

    function decoded(raw: string) {
      if (!isCurrent() || lockedRef.current) return;
      lockedRef.current = true;
      setState("code_detected");
      stopScan();
      onDecodeRef.current(raw, generateAttemptId());
    }
    function processFrame() {
      if (!isCurrent() || lockedRef.current) return;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
          if (qr) { decoded(qr.data); return; }
        }
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    function startDecoder() {
      if (!isCurrent()) return;
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
              if (barcodes.length) { decoded(barcodes[0].rawValue as string); return; }
            } catch { /* A failed frame can be retried while this capture is current. */ }
            if (isCurrent() && !lockedRef.current) animFrameRef.current = requestAnimationFrame(detect);
          };
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        } catch { /* Native construction failed: use the cross-browser jsQR path. */ }
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    video.onloadedmetadata = () => {
      if (!isCurrent()) return;
      void video.play().then(startDecoder).catch(() => {
        if (isCurrent()) { stopScan(); setState("camera_unavailable"); }
      });
    };
    video.srcObject = stream;
  }, [stopScan]);

  const scanAgain = useCallback(() => {
    stopScan();
    void startScan();
  }, [startScan, stopScan]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startScan();
  }, [autoStart, startScan]);

  return { state, videoRef, canvasRef, startScan, stopScan, scanAgain, setState };
}
