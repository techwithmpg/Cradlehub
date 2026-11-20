/**
 * Pure platform helpers for distinguishing iPhone/iPad/iOS browsers from Android/desktop.
 * Used to avoid offering incompatible Android APK downloads to iOS devices.
 */
export function isIosUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\b(?:iPhone|iPad|iPod)\b/i.test(userAgent);
}

export function isIosBrowserClient(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isIosUserAgent(navigator.userAgent)) return true;
  // iPadOS 13+ desktop Safari reports Macintosh with touch points > 1
  if (
    typeof navigator.platform === "string" &&
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}
