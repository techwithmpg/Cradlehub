import { useState, useEffect, useSyncExternalStore } from "react";

export type NetworkStatus = {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  lastChangedAt: Date | null;
};

function subscribeToNetwork(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useNetworkStatus(): NetworkStatus {
  // useSyncExternalStore avoids hydration mismatch and the setState-in-effect lint rule.
  // Server snapshot returns true (assume online); client snapshot reads navigator.onLine.
  const isOnline = useSyncExternalStore(
    subscribeToNetwork,
    () => navigator.onLine,
    () => true
  );

  const [meta, setMeta] = useState<{ wasOffline: boolean; lastChangedAt: Date | null }>({
    wasOffline: false,
    lastChangedAt: null,
  });

  useEffect(() => {
    function handleOffline() {
      setMeta({ wasOffline: true, lastChangedAt: new Date() });
    }
    function handleOnline() {
      setMeta((prev) => ({ ...prev, lastChangedAt: new Date() }));
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline: meta.wasOffline,
    lastChangedAt: meta.lastChangedAt,
  };
}
