"use client";
import { useSyncExternalStore } from "react";
import { useNativeDriverHost } from "@/lib/driver/native-host";
function subscribe(fn: () => void) {
  window.addEventListener("cradle-driver-device-status", fn);
  return () => window.removeEventListener("cradle-driver-device-status", fn);
}
export function DriverNativeStatus() {
  const native = useNativeDriverHost();
  const status = useSyncExternalStore(
    subscribe,
    () =>
      String(
        (window as Window & { __cradleDriverDeviceStatus?: string }).__cradleDriverDeviceStatus ??
          "checking"
      ),
    () => "checking"
  );
  if (!native) return null;
  return (
    <section
      className="mt-4 rounded-xl border border-[#e1e6da] bg-white p-4"
      aria-label="Android capabilities"
    >
      <h2 className="text-sm font-semibold">Android trip alerts</h2>
      <p role="status" className="mt-2 text-xs text-[#65746b]">
        {status === "registered"
          ? "Native alerts registered for this signed-in account."
          : status === "denied"
            ? "Notification permission is off."
            : status === "unavailable"
              ? "Native alert service is not configured or could not be reached."
              : "Checking native alerts…"}
      </p>
      <a
        href="/staff/driver/more?nativeAction=notifications"
        className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-[#19563c]"
      >
        Notification settings
      </a>
    </section>
  );
}
