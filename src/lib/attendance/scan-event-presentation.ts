import type { AttendanceScanEvent } from "@/lib/attendance/types";

export type AttendanceScanEventPresentation = {
  label: string;
  tone: "success" | "warning" | "error";
};

export function presentAttendanceScanEvent(
  event: AttendanceScanEvent
): AttendanceScanEventPresentation {
  const code = event.reason_code?.toLowerCase() ?? "";
  const action = event.action.toLowerCase();
  if (event.outcome === "success") {
    if (action.includes("clock_out")) return { label: "Scanned out", tone: "success" };
    if (action.includes("clock_in")) return { label: "Scanned in", tone: "success" };
    if (action.includes("session")) return { label: "Service session started", tone: "success" };
    if (action.includes("activate") || action.includes("device"))
      return { label: "Phone connected", tone: "success" };
    return { label: "Scan completed", tone: "success" };
  }
  if (code.includes("wrong_branch")) return { label: "Wrong branch", tone: "error" };
  if (code.includes("device") || code.includes("cookie"))
    return { label: "Phone registration required", tone: "error" };
  if (code.includes("clock_out") || code.includes("closing"))
    return { label: "Clock-out needs review", tone: "warning" };
  if (code.includes("duplicate")) return { label: "Scan already received", tone: "warning" };
  if (event.outcome === "blocked" || event.outcome === "error")
    return { label: "Scan blocked", tone: "error" };
  return { label: "Scan needs review", tone: "warning" };
}
