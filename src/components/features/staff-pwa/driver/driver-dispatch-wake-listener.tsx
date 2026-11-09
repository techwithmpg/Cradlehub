"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * While an authenticated driver has the PWA in the foreground, the existing
 * push worker can wake the combined map. Background notifications still
 * require an explicit human tap, as browsers do not allow forced launches.
 */
export function DriverDispatchWakeListener() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname?.startsWith("/staff/driver")) return;
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; actionHref?: unknown } | null;
      if (data?.type !== "CRADLEHUB_DRIVER_DISPATCH_WAKE") return;
      if (document.visibilityState !== "visible") return;
      const href = data.actionHref;
      if (typeof href !== "string" ||
          !/^\/staff\/driver\/map\?bookingId=[0-9a-f-]{36}$/i.test(href)) return;
      if (pathname === "/staff/driver/map") {
        window.dispatchEvent(new Event("CRADLEHUB_DRIVER_DISPATCH_UPDATE"));
        router.refresh();
      } else {
        router.push(href);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [router, pathname]);
  return null;
}
