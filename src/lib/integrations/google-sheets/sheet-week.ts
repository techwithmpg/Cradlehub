export const BUSINESS_TIMEZONE = "Asia/Manila" as const;

const MONTHS: Record<string, number> = {
  JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3,
  APR: 4, APRIL: 4, MAY: 5, JUN: 6, JUNE: 6, JUL: 7, JULY: 7,
  AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9, OCT: 10,
  OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function businessDateInManila(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseOperationalDate(raw: string): string | null {
  const value = raw.trim().replace(/\./g, "");
  const numeric = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) return isoDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]));

  const named = value.match(/^(?:(?:MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*\s*,?\s+)?([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (!named) return null;
  const month = MONTHS[named[1]!.toUpperCase()];
  return month ? isoDate(Number(named[3]), month, Number(named[2])) : null;
}

export interface WeeklyTab {
  name: string;
  startDate: string;
  endDate: string;
}

export function parseWeeklyTab(name: string): WeeklyTab | null {
  const match = name.trim().match(/^([A-Z]+)\.?\s*(\d{1,2})\s*-\s*(?:([A-Z]+)\.?\s*)?(\d{1,2}),?\s*(\d{4})$/i);
  if (!match) return null;
  const startMonth = MONTHS[match[1]!.toUpperCase()];
  const endMonth = match[3] ? MONTHS[match[3].toUpperCase()] : startMonth;
  if (!startMonth || !endMonth) return null;
  const endYear = Number(match[5]);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  const startDate = isoDate(startYear, startMonth, Number(match[2]));
  const endDate = isoDate(endYear, endMonth, Number(match[4]));
  if (!startDate || !endDate || addDays(startDate, 6) !== endDate) return null;
  return { name, startDate, endDate };
}

export type WeeklyTabSelection =
  | { status: "selected"; current: WeeklyTab; previous: WeeklyTab }
  | { status: "ambiguous"; reasons: string[] };

export function selectCurrentAndPreviousTabs(
  tabNames: readonly string[],
  businessDate: string,
): WeeklyTabSelection {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) ||
    Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`)) ||
    new Date(`${businessDate}T00:00:00Z`).toISOString().slice(0, 10) !== businessDate) {
    return { status: "ambiguous", reasons: ["Invalid business date"] };
  }
  const day = new Date(`${businessDate}T00:00:00Z`).getUTCDay();
  const currentStart = addDays(businessDate, -((day - 5 + 7) % 7));
  const previousStart = addDays(currentStart, -7);
  const parsed = tabNames.map(parseWeeklyTab).filter((tab): tab is WeeklyTab => tab !== null);
  const current = parsed.filter((tab) => tab.startDate === currentStart);
  const previous = parsed.filter((tab) => tab.startDate === previousStart);
  const reasons: string[] = [];
  if (current.length !== 1) reasons.push(`Expected one current weekly tab for ${currentStart}; found ${current.length}`);
  if (previous.length !== 1) reasons.push(`Expected one previous weekly tab for ${previousStart}; found ${previous.length}`);
  if (reasons.length) return { status: "ambiguous", reasons };
  return { status: "selected", current: current[0]!, previous: previous[0]! };
}
