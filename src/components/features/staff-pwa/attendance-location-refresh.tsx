"use client";

import { useEffect } from "react";
import { warmAttendanceLocation } from "@/lib/attendance/browser-location";

/** Readiness only: a scan always obtains its own fresh location reading. */
export function AttendanceLocationRefresh() {
  useEffect(() => {
    void warmAttendanceLocation();
    const onVisible = () => {
      if (document.visibilityState === "visible") void warmAttendanceLocation();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
