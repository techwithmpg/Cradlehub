"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { ConnectivityState } from "./types";

type ConnectivityBannerProps = {
  explicitState?: ConnectivityState;
  onRetry?: () => void;
};

export function StaffConnectivityBanner({
  explicitState,
  onRetry,
}: ConnectivityBannerProps) {
  const { isOffline, wasOffline, isOnline } = useNetworkStatus();

  // If an explicit override state is passed (e.g. from a failed mutation), use it
  if (explicitState === "REQUEST_FAILED") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center justify-between gap-2 bg-[#FDEBEC] px-4 py-2 text-xs font-medium text-[#9B1C20] border-b border-[#F5C2C4]"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          <span>Request failed. Actions were not recorded. Please check your connection.</span>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-[#9B1C20] shadow-xs border border-[#F5C2C4] hover:bg-[#FDEBEC] active:scale-95"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (explicitState === "NOT_RECORDED") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center gap-2 bg-[#FDEBEC] px-4 py-2 text-xs font-medium text-[#9B1C20] border-b border-[#F5C2C4]"
      >
        <AlertCircle size={15} aria-hidden="true" />
        <span>Action not recorded by server. Check connectivity before retrying.</span>
      </div>
    );
  }

  if (explicitState === "RECONNECTING") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-[#FFF4DB] px-4 py-2 text-xs font-medium text-[#654600] border-b border-[#FEE199]"
      >
        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
        <span>Reconnecting to CradleHub server...</span>
      </div>
    );
  }

  // Automatic browser connectivity checks
  if (isOffline || explicitState === "OFFLINE") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center gap-2 bg-[#1C1917] px-4 py-2.5 text-xs font-medium text-[#FEF3C7] shadow-sm"
      >
        <WifiOff size={15} className="text-[#FEF3C7] shrink-0" aria-hidden="true" />
        <span>You&apos;re offline. Check your connection — actions that write data are disabled.</span>
      </div>
    );
  }

  if (wasOffline && isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-[#14532D] px-4 py-2 text-xs font-medium text-[#DCFCE7]"
      >
        <Wifi size={14} className="text-[#DCFCE7] shrink-0" aria-hidden="true" />
        <span>Back online. Refreshing operational workspace.</span>
      </div>
    );
  }

  return null;
}
