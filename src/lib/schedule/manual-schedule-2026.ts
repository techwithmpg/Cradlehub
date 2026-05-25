/**
 * manual-schedule-2026.ts
 *
 * The spa's current paper schedule rules encoded as structured data.
 * Names are stored exactly as they appear on the paper schedule (ALL CAPS).
 * Do NOT put staff IDs here — name→staff matching happens at runtime.
 *
 * Day of week: 0 = Sunday … 6 = Saturday
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

// ── Day-Off Schedule 2026 — regular staff ─────────────────────────────────────
// Days not listed = staff works that day (regular or opening shift).
export const MANUAL_DAY_OFF_2026: Partial<Record<DayOfWeek, string[]>> = {
  1: ["JANET", "CHECHE", "JOHANNA", "RICHELLE", "MARICAR", "LYA", "JACQLYN", "NIKKI", "RIA", "VIEL", "ROSE"],
  2: ["JANET", "CHECHE", "JOHANNA", "RICHELLE", "LYA", "NIKKI", "RIA", "WENG", "CHENNY", "ELLA", "JACQLYN"],
  3: ["MECK", "MARJORIE", "DIVINE", "CHENNY", "MINORKA", "VINA", "ELLA", "BENJIE", "WENG", "LORRAINE", "GIGI"],
  4: ["MECK", "MARJORIE", "DIVINE", "MAYROSE", "SHIELA", "VINA", "VIBILYN", "MAE", "FRANNIE", "THERESA", "DANICA"],
  5: ["MAYROSE", "SHIELA", "ZAIRELLE", "THERESA", "RONA", "JANE", "MARINELLE", "FRANNIE", "MARIE", "RODAH"],
};

// ── Salon Day-Off Schedule ────────────────────────────────────────────────────
export const MANUAL_SALON_DAY_OFF_2026: Partial<Record<DayOfWeek, string[]>> = {
  0: ["RIZA"],
  1: ["MELLROSE", "RIZZA"],
  2: ["RENALYN"],
  4: ["EZRAH"],
  5: ["ALEXIS"],
};

// ── Opening Duty Schedule 2026 ────────────────────────────────────────────────
// Staff listed here work the opening shift on that day (earlier start time).
export const MANUAL_OPENING_2026: Partial<Record<DayOfWeek, string[]>> = {
  0: ["MECK", "CHENNY", "JOHANNA", "LORRAINE", "ELLA"],
  1: ["VIBILYN", "SHIELA", "GIGI"],
  2: ["MINORKA", "MARIE", "MARJORIE"],
  3: ["JOHANNA", "FRANNIE", "MAYROSE"],
  4: ["JOHANNA", "JANE", "ROSE"],
  5: ["LYA", "JOHANNA", "MAE"],
  6: ["JOHANNA", "JANET", "WENG", "NIKKI"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All unique paper names across every schedule list. */
export function getAllPaperNames(): string[] {
  const names = new Set<string>();
  for (const list of Object.values(MANUAL_DAY_OFF_2026)) {
    for (const n of list) names.add(n);
  }
  for (const list of Object.values(MANUAL_SALON_DAY_OFF_2026)) {
    for (const n of list) names.add(n);
  }
  for (const list of Object.values(MANUAL_OPENING_2026)) {
    for (const n of list) names.add(n);
  }
  return [...names].sort();
}

/** Per-name: which days are off and which days are opening duty. */
export type NameScheduleSummary = {
  offDays: DayOfWeek[];       // 0-6 where this name is listed as day-off
  openingDays: DayOfWeek[];   // 0-6 where this name is listed for opening
};

export function getNameScheduleSummary(paperName: string): NameScheduleSummary {
  const upper = paperName.toUpperCase();
  const offDays: DayOfWeek[] = [];
  const openingDays: DayOfWeek[] = [];

  const allOff: Partial<Record<DayOfWeek, string[]>> = {
    ...MANUAL_DAY_OFF_2026,
  };
  // Merge salon day-off into the combined off map
  for (const [d, names] of Object.entries(MANUAL_SALON_DAY_OFF_2026) as [string, string[]][]) {
    const day = Number(d) as DayOfWeek;
    const existing = allOff[day] ?? [];
    allOff[day] = [...existing, ...names];
  }

  for (const [d, names] of Object.entries(allOff) as [string, string[]][]) {
    if (names.map((n) => n.toUpperCase()).includes(upper)) {
      offDays.push(Number(d) as DayOfWeek);
    }
  }

  for (const [d, names] of Object.entries(MANUAL_OPENING_2026) as [string, string[]][]) {
    if (names.map((n) => n.toUpperCase()).includes(upper)) {
      openingDays.push(Number(d) as DayOfWeek);
    }
  }

  return { offDays, openingDays };
}

/** Detect names that appear as both off and opening on the same day. */
export function detectOpeningOffConflicts(): Array<{ name: string; day: DayOfWeek }> {
  const conflicts: Array<{ name: string; day: DayOfWeek }> = [];
  for (const name of getAllPaperNames()) {
    const { offDays, openingDays } = getNameScheduleSummary(name);
    for (const day of openingDays) {
      if (offDays.includes(day)) {
        conflicts.push({ name, day });
      }
    }
  }
  return conflicts;
}
