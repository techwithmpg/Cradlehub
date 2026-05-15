"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOffline, wasOffline, isOnline } = useNetworkStatus();

  if (!isOffline && !wasOffline) return null;

  if (isOffline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#1C1917",
          color: "#FEF3C7",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        <WifiOff size={14} aria-hidden="true" />
        You&rsquo;re offline. Check your connection — actions that write data are disabled.
      </div>
    );
  }

  if (wasOffline && isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#14532D",
          color: "#DCFCE7",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        Back online.
      </div>
    );
  }

  return null;
}
