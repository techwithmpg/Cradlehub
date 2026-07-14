import { timeToMinutes } from "@/lib/utils/time-format";

export type AttendanceGreetingAction = "clock_in" | "clock_out" | "captured";

export type AttendanceGreeting = {
  displayName: string;
  title: string;
  message: string;
};

type AttendanceGreetingInput = {
  staffId: string;
  nickname?: string | null;
  fullName?: string | null;
  branchLocalTime: string;
  action: AttendanceGreetingAction;
  reasonCode: string;
  requestId?: string | null;
  businessDate: string;
};

const GENERIC_NAMES = new Set([
  "staff",
  "staff member",
  "unknown",
  "unknown staff",
  "n/a",
  "na",
]);

const CLOCK_IN_TITLES = {
  morning: [
    "Good morning, {name} 🌿",
    "Welcome in, {name} ☀️",
    "Ready for a great day, {name}? 🌿",
    "You’re all set, {name} ✨",
  ],
  afternoon: [
    "Good afternoon, {name} 🌿",
    "Welcome to your shift, {name} ✨",
    "You’re ready to go, {name} 🌿",
    "Have a great shift, {name} ☀️",
  ],
  evening: [
    "Good evening, {name} 🌙",
    "Welcome in, {name} ✨",
    "You’re all set for the evening, {name} 🌿",
    "Have a smooth shift, {name} 🌙",
  ],
  overnight: [
    "Welcome in, {name} 🌙",
    "You’re ready to go, {name} ✨",
    "Have a smooth shift, {name} 🌿",
    "You’re all set, {name} 🌙",
  ],
} as const;

const CLOCK_OUT_TITLES = [
  "All done, {name} ✨",
  "Great work today, {name} 🌿",
  "Shift complete, {name} 🙌",
  "You’re checked out, {name} 🌙",
  "Nice work, {name} ✨",
] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choose<T>(items: readonly T[], seed: string, offset = 0): T {
  return items[(stableHash(`${seed}:${offset}`) % items.length)]!;
}

function usefulName(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized || GENERIC_NAMES.has(normalized.toLowerCase())) return null;
  return normalized;
}

export function getAttendanceGreetingName(input: {
  nickname?: string | null;
  fullName?: string | null;
}): string {
  const nickname = usefulName(input.nickname);
  if (nickname) return nickname;

  const fullName = usefulName(input.fullName);
  const firstName = fullName?.split(" ")[0]?.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, "");
  return usefulName(firstName) ?? "there";
}

function greetingPeriod(branchLocalTime: string): keyof typeof CLOCK_IN_TITLES {
  const minutes = timeToMinutes(branchLocalTime) ?? 0;
  if (minutes < 5 * 60) return "overnight";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

function formatBranchTime(branchLocalTime: string): string {
  const minutes = timeToMinutes(branchLocalTime) ?? 0;
  const hours = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function personalize(template: string, displayName: string): string {
  return template.replace("{name}", displayName);
}

export function attendanceReviewLabel(
  reasonCode: string | null | undefined,
  reviewRequired: boolean
): string | undefined {
  if (!reviewRequired) return undefined;
  switch (reasonCode) {
    case "early_clock_in":
      return "Recorded · Early clock-in";
    case "late_clock_in":
      return "Recorded · Late clock-in";
    case "ambiguous_scan":
      return "Recorded · Outside schedule";
    case "missing_schedule":
      return "Recorded · No schedule found";
    case "off_day_exception":
      return "Recorded · Scheduled off day";
    case "early_clock_out":
      return "Recorded · Early clock-out";
    case "overtime_clock_out":
      return "Recorded · Overtime";
    default:
      return "Recorded · Review required";
  }
}

export function buildAttendanceGreeting(input: AttendanceGreetingInput): AttendanceGreeting {
  const displayName = getAttendanceGreetingName(input);
  const seed = [
    input.staffId,
    input.businessDate,
    input.action,
    input.reasonCode,
    input.requestId ?? "no-request",
  ].join("|");

  if (input.action === "captured") {
    return {
      displayName,
      title: `Scan captured, ${displayName}`,
      message: "The front desk will confirm today’s attendance. You may continue normally.",
    };
  }

  if (input.action === "clock_in" && input.reasonCode === "ambiguous_scan") {
    return {
      displayName,
      title: `You’re clocked in, ${displayName} 🌿`,
      message: "This scan was outside your schedule, so the front desk will review it.",
    };
  }

  const formattedTime = formatBranchTime(input.branchLocalTime);
  if (input.action === "clock_in") {
    const title = choose(CLOCK_IN_TITLES[greetingPeriod(input.branchLocalTime)], seed);
    return {
      displayName,
      title: personalize(title, displayName),
      message: `You’re clocked in at ${formattedTime}. Have a lovely day!`,
    };
  }

  const clockOutMessages = greetingPeriod(input.branchLocalTime) === "evening"
    ? [
        `You’re clocked out at ${formattedTime}. Have a restful evening!`,
        `Your clock-out was recorded at ${formattedTime}. Enjoy your evening!`,
        `Clock-out complete at ${formattedTime}. Have a safe trip home!`,
      ]
    : greetingPeriod(input.branchLocalTime) === "overnight"
      ? [
          `You’re clocked out at ${formattedTime}. Rest well!`,
          `Your clock-out was recorded at ${formattedTime}. Take care on your way home!`,
          `Clock-out complete at ${formattedTime}. Have a safe trip home!`,
        ]
      : [
          `You’re clocked out at ${formattedTime}. Enjoy the rest of your day!`,
          `Your clock-out was recorded at ${formattedTime}. Rest well!`,
          `Clock-out complete at ${formattedTime}. Have a safe trip home!`,
        ];

  return {
    displayName,
    title: personalize(choose(CLOCK_OUT_TITLES, seed), displayName),
    message: choose(clockOutMessages, seed, 1),
  };
}
