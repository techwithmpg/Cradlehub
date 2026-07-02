import { maskPublicCode } from "@/lib/attendance/qr-url";
import type { AttendanceQrPoint, AttendanceScanEvent } from "@/lib/attendance/types";

const MANILA_TIME_ZONE = "Asia/Manila";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getQrPointSubtitle(point: AttendanceQrPoint): string {
  if (point.description) return point.description;
  if (point.point_type === "attendance") return "Staff attendance";
  if (point.point_type === "room") return "Treatment Room";
  return point.resource_name ?? "Entrance Point";
}

export function getQrPointTypeLabel(point: AttendanceQrPoint): string {
  if (point.point_type === "attendance") return "Attendance";
  if (point.point_type === "room") return "Room";

  const text = `${point.label} ${point.description ?? ""} ${point.resource_name ?? ""}`.toLowerCase();
  if (text.includes("equipment") || text.includes("machine")) return "Equipment";
  if (text.includes("door") || text.includes("entrance") || text.includes("vip")) return "Other";
  return "Resource";
}

export function getLatestScanEvent(point: AttendanceQrPoint, events: AttendanceScanEvent[]): AttendanceScanEvent | null {
  return events
    .filter((event) => event.point_label === point.label)
    .reduce<AttendanceScanEvent | null>((latest, event) => {
      if (!latest) return event;
      return new Date(event.created_at).getTime() > new Date(latest.created_at).getTime() ? event : latest;
    }, null);
}

export function formatLastScanned(value: string | null | undefined): { primary: string; secondary: string; full: string } {
  if (!value) return { primary: "-", secondary: "Never", full: "Never" };

  const date = new Date(value);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 86_400_000));
  const primary =
    dateKey === todayKey
      ? "Today"
      : dateKey === yesterdayKey
        ? "Yesterday"
        : new Intl.DateTimeFormat("en-US", { timeZone: MANILA_TIME_ZONE, month: "short", day: "numeric" }).format(date);
  const secondary = new Intl.DateTimeFormat("en-US", { timeZone: MANILA_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(date);

  return { primary, secondary, full: `${primary} ${secondary}` };
}

export function formatQrInfoDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function displayQrScanLink(point: AttendanceQrPoint): string {
  const maskedCode = maskPublicCode(point.public_code);
  try {
    const url = new URL(point.scan_url);
    const host = LOCAL_HOSTS.has(url.hostname) ? "cradlewellnessliving.com" : url.host;
    const path = url.pathname.replace(encodeURIComponent(point.public_code), maskedCode).replace(point.public_code, maskedCode);
    return `${host}${path}`;
  } catch {
    return `cradlewellnessliving.com/scan/${maskedCode}`;
  }
}
