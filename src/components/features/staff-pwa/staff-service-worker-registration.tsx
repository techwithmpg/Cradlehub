"use client";

import { useEffect } from "react";

/**
 * Registers only the Staff installability worker. It intentionally does not
 * add offline caching or replace the existing push-worker registration.
 */
export function StaffServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/staff-sw.js", {
        scope: "/staff/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Installability is progressive; a registration failure must not
        // block the authenticated Staff workspace from rendering.
      });
  }, []);

  return null;
}
