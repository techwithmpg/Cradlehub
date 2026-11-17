"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
export function DriverConnectivity({ verifiedAt }: { verifiedAt?: string }) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
  const router = useRouter();
  const [now, setNow] = useState(() => (verifiedAt ? Date.parse(verifiedAt) : 0));
  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  const stale = verifiedAt && now - Date.parse(verifiedAt) > 60000;
  return (
    <p
      role="status"
      className={
        online && !stale
          ? "text-xs text-[#526b59]"
          : "rounded-lg bg-amber-50 p-3 text-xs text-amber-900"
      }
    >
      {!online
        ? "Offline · displayed assignments may be outdated. Reconnect before starting."
        : stale
          ? "Assignments have not been refreshed recently. Refresh before acting."
          : "Connected · assignments verified when refreshed"}
    </p>
  );
}
