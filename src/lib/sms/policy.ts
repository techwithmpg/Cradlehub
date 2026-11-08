/**
 * Customer appointment SMS policy. Pure functions: no credentials, database or network.
 * All times are Philippine business times (no dependence on a server's local timezone).
 * The booking engine, not this feature, remains the booking-state authority.
 */
export type SmsKind = "confirmation" | "morning" | "one_hour";
export type SmsVisit = {
  key: string;
  bookingId: string;
  orderId: string | null;
  customerId: string;
  customerName: string;
  phone: string;
  branchName: string;
  serviceNames: string[];
  date: string;
  startTime: string;
  homeService: boolean;
  statuses: string[];
  progress: (string | null)[];
  sessionStarted: boolean;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MANILA_OFFSET = "+08:00";
const PH_TIMEZONE = "Asia/Manila";

export function smsPhoneE164(value: string): string | null {
  const phone = value.trim().replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(phone)) return "+63" + phone.slice(1);
  if (/^639\d{9}$/.test(phone)) return "+" + phone;
  if (/^\+639\d{9}$/.test(phone)) return phone;
  // Do not guess foreign destinations or reinterpret their country code.
  return null;
}

export function appointmentMs(date: string, time: string): number {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^\d\d:\d\d(?::\d\d)?$/.test(time)) {
    return Number.NaN;
  }
  const hhmmss = time.length === 5 ? time + ":00" : time;
  const result = Date.parse(date + "T" + hhmmss + MANILA_OFFSET);
  if (!Number.isFinite(result)) return Number.NaN;
  // Reject normalized invalid dates/times (e.g. Feb 30).
  const local = new Date(result).toLocaleString("sv-SE", {
    timeZone: PH_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  return local.startsWith(date + " " + hhmmss) ? result : Number.NaN;
}

export function businessDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function localMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PH_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isActiveUnstartedVisit(visit: SmsVisit): boolean {
  return visit.statuses.length > 0 &&
    visit.statuses.every((status) => status === "confirmed") &&
    !visit.sessionStarted &&
    visit.progress.every((status) => !status || ["confirmed", "not_started"].includes(status));
}

export function isSmsDue(
  kind: SmsKind,
  visit: SmsVisit,
  now: Date,
  confirmedEventAt?: string
): boolean {
  if (!isActiveUnstartedVisit(visit)) return false;
  const start = appointmentMs(visit.date, visit.startTime);
  const nowMs = now.getTime();
  if (!Number.isFinite(start) || start <= nowMs) return false;
  if (kind === "confirmation") {
    const eventMs = confirmedEventAt ? Date.parse(confirmedEventAt) : Number.NaN;
    return Number.isFinite(eventMs) && eventMs <= nowMs &&
      nowMs - eventMs <= 2 * HOUR && start - nowMs >= 10 * MINUTE;
  }
  if (kind === "morning") {
    return visit.date === businessDate(now) &&
      localMinutes(now) >= 8 * 60 && localMinutes(now) < 12 * 60 &&
      start - nowMs >= 2 * HOUR;
  }
  // One-hour reminder uses a bounded catch-up window, not hours-late messages.
  return start - nowMs <= HOUR && start - nowMs >= 50 * MINUTE;
}

export function smsDedupeKey(kind: SmsKind, visit: SmsVisit): string {
  return [kind, visit.key, visit.customerId, visit.date, visit.startTime.slice(0, 5)].join(":");
}

function compact(value: string, max = 34): string {
  return value.normalize("NFKD").replace(/[^ -~]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function displayTime(raw: string): string {
  const hour = Number(raw.slice(0, 2));
  const minute = raw.slice(3, 5);
  return (hour % 12 || 12) + ":" + minute + (hour >= 12 ? " PM" : " AM");
}

export function smsMessage(kind: SmsKind, visit: SmsVisit): string {
  const name = compact(visit.customerName.split(/\s+/)[0] || "there", 18) || "there";
  const time = displayTime(visit.startTime);
  const branch = compact(visit.branchName, 25) || "Cradle Spa";
  const service = visit.serviceNames.length === 1
    ? compact(visit.serviceNames[0], 36)
    : "booked services";
  const location = visit.homeService ? "home service" : branch;
  if (kind === "confirmation") {
    return "Hi " + name + "! Your Cradle Spa " + location +
      " appointment is confirmed for " + visit.date + " at " + time + ". Thank you!";
  }
  if (kind === "morning") {
    return "Good morning, " + name + "! Your Cradle Spa " + location +
      " appointment is today at " + time + ". We look forward to seeing you!";
  }
  return visit.homeService
    ? "Hi " + name + "! Your Cradle Spa " + service + " home service starts in about 1 hour, at " +
      time + ". Please have your space ready."
    : "Hi " + name + "! Your Cradle Spa " + service + " is in about 1 hour, at " +
      time + " (" + branch + "). Please arrive 10 minutes early.";
}
