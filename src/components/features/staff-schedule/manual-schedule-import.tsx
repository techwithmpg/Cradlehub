"use client";

/**
 * ManualScheduleImport
 *
 * Collapsible section inside /crm/staff-availability that walks CRM through
 * importing the spa's 2026 manual paper schedule into the system.
 *
 * Flow: Preview → Match Names → Set Times → Review & Apply
 *
 * Props: staff list from the already-fetched page data (no extra query).
 */

import { useState, useMemo, useTransition } from "react";
import {
  getAllPaperNames,
  getNameScheduleSummary,
  DAY_LABELS,
  MANUAL_DAY_OFF_2026,
  MANUAL_SALON_DAY_OFF_2026,
  MANUAL_OPENING_2026,
  detectOpeningOffConflicts,
  PAPER_NAME_ALIASES,
} from "@/lib/schedule/manual-schedule-2026";
import type { DayOfWeek } from "@/lib/schedule/manual-schedule-2026";
import { applyManualScheduleImportAction } from "@/app/(dashboard)/crm/staff-availability/actions";
import type { ApplyImportResult } from "@/app/(dashboard)/crm/staff-availability/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffOption = {
  id: string;
  full_name: string;
  nickname: string | null;
  is_active: boolean;
};

type MatchStatus = "matched" | "ambiguous" | "unmatched" | "skipped";

type NameMatch = {
  paperName: string;
  status: MatchStatus;
  candidates: StaffOption[];
  selectedId: string | null; // user-selected override for ambiguous/unmatched
};

// ── Name matching helpers ─────────────────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Levenshtein edit distance (insertions, deletions, substitutions).
 * Space-optimised O(min(m,n)) implementation.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Keep the shorter string in the inner loop
  if (a.length > b.length) { const t = a; a = b; b = t; }
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    const curr: number[] = [j];
    for (let i = 1; i <= a.length; i++) {
      curr.push(
        a[i - 1] === b[j - 1]
          ? prev[i - 1]!
          : 1 + Math.min(prev[i]!, curr[i - 1]!, prev[i - 1]!),
      );
    }
    prev = curr;
  }
  return prev[a.length]!;
}

/** Resolve the effective search term for a paper name (respects alias overrides). */
function resolveSearchNorm(paperName: string): string {
  const alias = PAPER_NAME_ALIASES[paperName.toUpperCase()];
  return alias ? normName(alias) : normName(paperName);
}

/** Words of a staff member's full name, lower-cased. */
function nameWords(s: StaffOption): string[] {
  return s.full_name.split(/\s+/).map((w) => normName(w));
}

/**
 * Match a single paper name against the staff list using a tiered strategy:
 *
 *  Tier 1 – Exact:      full_name === search, nickname === search, or any name-word === search
 *  Tier 2 – Prefix:     any name-word *starts with* search (min 3 chars); catches shortened nicknames
 *  Tier 3 – Fuzzy:      edit distance ≤ 1 (names ≥ 4 chars) or ≤ 2 (names ≥ 6 chars);
 *                        catches spelling variants like MELLROSE↔Melrose, SHIELA↔Sheila,
 *                        JACQLYN↔Jacquelyn, EZRAH↔Ezra, RIZZA↔Riza
 *
 * If PAPER_NAME_ALIASES has an entry for the paper name, its value is used as the
 * search term instead (useful for nicknames like MECK → Mercedes, WENG → Wendy).
 *
 * Each tier is evaluated in order; the first tier that finds at least one candidate
 * is used. Multiple candidates at the same tier → "ambiguous" (user must pick).
 */
function matchPaperName(paperName: string, staff: StaffOption[]): NameMatch {
  const searchNorm = resolveSearchNorm(paperName);

  const makeResult = (found: StaffOption[]): NameMatch => ({
    paperName,
    status: found.length === 1 ? "matched" : "ambiguous",
    candidates: found,
    selectedId: found.length === 1 ? (found[0]?.id ?? null) : null,
  });

  // ── Tier 1: exact ──────────────────────────────────────────────────────────
  let candidates = staff.filter((s) => {
    const nick = s.nickname ? normName(s.nickname) : null;
    return (
      normName(s.full_name) === searchNorm ||
      nick === searchNorm ||
      nameWords(s).some((w) => w === searchNorm)
    );
  });
  if (candidates.length > 0) return makeResult(candidates);

  // ── Tier 2: prefix (paper name is a prefix of a name word, min 3 chars) ──
  if (searchNorm.length >= 3) {
    candidates = staff.filter((s) =>
      nameWords(s).some(
        (w) => w.startsWith(searchNorm) && w.length > searchNorm.length,
      ),
    );
    if (candidates.length > 0) return makeResult(candidates);
  }

  // ── Tier 3: fuzzy edit-distance ────────────────────────────────────────────
  if (searchNorm.length >= 4) {
    // Allow 1 edit for names ≥ 4 chars, 2 edits for names ≥ 6 chars.
    // The length-difference guard prevents short names from matching much-longer ones.
    const maxDist = searchNorm.length >= 6 ? 2 : 1;
    candidates = staff.filter((s) => {
      const words = nameWords(s);
      const nick = s.nickname ? normName(s.nickname) : null;
      const wordMatch = words.some(
        (w) =>
          Math.abs(w.length - searchNorm.length) <= maxDist &&
          editDistance(w, searchNorm) <= maxDist,
      );
      const nickMatch =
        nick != null &&
        Math.abs(nick.length - searchNorm.length) <= maxDist &&
        editDistance(nick, searchNorm) <= maxDist;
      return wordMatch || nickMatch;
    });
    if (candidates.length > 0) return makeResult(candidates);
  }

  return { paperName, status: "unmatched", candidates: [], selectedId: null };
}

function computeMatches(
  paperNames: string[],
  staff: StaffOption[]
): Record<string, NameMatch> {
  const result: Record<string, NameMatch> = {};
  for (const name of paperNames) {
    result[name] = matchPaperName(name, staff);
  }
  return result;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatchStatus | "pending" }) {
  const map: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    matched:   { label: "Matched",   color: "var(--cs-success,#27ae60)", bg: "rgba(39,174,96,0.08)" },
    ambiguous: { label: "Ambiguous", color: "var(--cs-warning,#e67e22)", bg: "rgba(230,126,34,0.08)" },
    unmatched: { label: "Not Found", color: "var(--cs-error,#e74c3c)",   bg: "rgba(231,76,60,0.08)" },
    skipped:   { label: "Skipped",   color: "var(--cs-text-muted)",      bg: "var(--cs-surface-warm)" },
    pending:   { label: "Pending",   color: "var(--cs-text-muted)",      bg: "var(--cs-surface-warm)" },
  };
  const s = map[status] ?? map.pending!;
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        padding: "2px 8px",
        borderRadius: 12,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

const DAYS_WITH_LABELS: [DayOfWeek, string][] = [
  [0, "Sunday"], [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"],
  [4, "Thursday"], [5, "Friday"], [6, "Saturday"],
];

function SchedulePreviewCard({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: Partial<Record<DayOfWeek, string[]>>;
  emptyLabel: string;
}) {
  const hasData = Object.keys(data).length > 0;
  return (
    <div
      className="cs-card"
      style={{ padding: "1rem 1.125rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}
    >
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
        {title}
      </div>
      {!hasData ? (
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {DAYS_WITH_LABELS.map(([day, label]) => {
            const names = data[day];
            if (!names || names.length === 0) return null;
            return (
              <div key={day} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text)", minWidth: 90, flexShrink: 0 }}>
                  {label}:
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                  {names.map((n) => n.charAt(0) + n.slice(1).toLowerCase()).join(", ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Time settings ─────────────────────────────────────────────────────────────

type TimeSettings = {
  regularStart: string;
  regularEnd: string;
  openingStart: string;
  openingEnd: string;
};

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 0.625rem",
          borderRadius: 8,
          border: "1px solid var(--cs-border)",
          background: "var(--cs-surface)",
          color: "var(--cs-text)",
          fontSize: "0.875rem",
          width: 130,
        }}
      />
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type TabKey = "preview" | "match" | "apply";

export function ManualScheduleImport({
  branchId,
  staff,
}: {
  branchId: string;
  staff: StaffOption[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("preview");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ApplyImportResult | null>(null);

  // ── Name matching state ──────────────────────────────────────────────────
  const paperNames = useMemo(() => getAllPaperNames(), []);
  const [matches, setMatches] = useState<Record<string, NameMatch>>(() =>
    computeMatches(paperNames, staff)
  );

  // ── Time settings state ─────────────────────────────────────────────────
  const [times, setTimes] = useState<TimeSettings>({
    regularStart: "10:00",
    regularEnd: "22:00",
    openingStart: "09:00",
    openingEnd: "21:30",
  });

  // ── Derived state ────────────────────────────────────────────────────────
  const matchList = useMemo(() => Object.values(matches), [matches]);

  const resolvedMatches = useMemo(
    () =>
      matchList.flatMap((m) => {
        if (m.status === "skipped") return [];
        const id = m.selectedId;
        if (!id) return [];
        return [{ paperName: m.paperName, staffId: id }];
      }),
    [matchList]
  );

  const unresolvedCritical = useMemo(
    () =>
      matchList.filter(
        (m) =>
          m.status !== "skipped" &&
          m.selectedId === null &&
          (m.status === "ambiguous" || m.status === "unmatched")
      ),
    [matchList]
  );

  const openingOffConflictsInData = useMemo(
    () => detectOpeningOffConflicts(),
    []
  );

  // Conflicts in resolved staff (opening + off on same day for same staff)
  const staffConflicts = useMemo(() => {
    const conflicts: Array<{ name: string; day: DayOfWeek }> = [];
    for (const { name, day } of openingOffConflictsInData) {
      const m = matches[name];
      if (m && m.status !== "skipped" && m.selectedId) {
        conflicts.push({ name, day });
      }
    }
    return conflicts;
  }, [matches, openingOffConflictsInData]);

  const canApply =
    unresolvedCritical.length === 0 &&
    staffConflicts.length === 0 &&
    resolvedMatches.length > 0 &&
    times.regularStart < times.regularEnd &&
    times.openingStart < times.openingEnd;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSelectStaff(paperName: string, staffId: string) {
    setMatches((prev) => {
      const existing = prev[paperName];
      if (!existing) return prev;
      return {
        ...prev,
        [paperName]: { ...existing, selectedId: staffId, status: "matched" },
      };
    });
  }

  function handleSkip(paperName: string) {
    setMatches((prev) => {
      const existing = prev[paperName];
      if (!existing) return prev;
      return {
        ...prev,
        [paperName]: { ...existing, status: "skipped", selectedId: null },
      };
    });
  }

  function handleUnskip(paperName: string) {
    setMatches((prev) => {
      const existing = prev[paperName];
      if (!existing) return prev;
      // Re-derive status from candidates
      const status: MatchStatus =
        existing.candidates.length === 1
          ? "matched"
          : existing.candidates.length > 1
            ? "ambiguous"
            : "unmatched";
      const selectedId =
        existing.candidates.length === 1
          ? (existing.candidates[0]?.id ?? null)
          : null;
      return { ...prev, [paperName]: { ...existing, status, selectedId } };
    });
  }

  function handleApply() {
    setResult(null);
    startTransition(async () => {
      const res = await applyManualScheduleImportAction({
        branchId,
        resolvedMatches,
        regularStart: times.regularStart,
        regularEnd: times.regularEnd,
        openingStart: times.openingStart,
        openingEnd: times.openingEnd,
      });
      setResult(res);
    });
  }

  // ── Counts ───────────────────────────────────────────────────────────────
  const countMatched = matchList.filter((m) => m.status === "matched" && m.selectedId).length;
  const countAmbiguous = matchList.filter((m) => m.status === "ambiguous" && !m.selectedId).length;
  const countNotFound = matchList.filter((m) => m.status === "unmatched").length;
  const countSkipped = matchList.filter((m) => m.status === "skipped").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── Collapsible header ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1.125rem",
          borderRadius: expanded ? "var(--cs-r-lg,10px) var(--cs-r-lg,10px) 0 0" : "var(--cs-r-lg,10px)",
          border: "1px solid var(--cs-border-soft)",
          background: "var(--cs-surface-warm)",
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
              Current Manual Schedule Setup
            </span>
            {result?.ok && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--cs-success,#27ae60)", background: "rgba(39,174,96,0.08)", padding: "2px 8px", borderRadius: 12 }}>
                ✓ Applied
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
            Import the spa&apos;s 2026 day-off and opening-duty schedule into CradleHub
          </span>
        </div>
        <span style={{ fontSize: 18, color: "var(--cs-text-muted)", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div
          style={{
            border: "1px solid var(--cs-border-soft)",
            borderTop: "none",
            borderRadius: "0 0 var(--cs-r-lg,10px) var(--cs-r-lg,10px)",
            background: "var(--cs-surface)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Info banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(41,128,185,0.05)",
              border: "1px solid rgba(41,128,185,0.2)",
              fontSize: "0.8125rem",
              color: "var(--cs-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--cs-info,#2980b9)" }}>How this works:</strong>
            {" This imports the current manual paper schedule into the system. Review matches before applying. Online booking will follow the saved schedule rules automatically. CRM live availability still depends on daily check-in."}
          </div>

          {/* Tab navigation */}
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--cs-border)" }}>
            {(["preview", "match", "apply"] as TabKey[]).map((tab) => {
              const labels: Record<TabKey, string> = {
                preview: "📅 Schedule Preview",
                match: `👤 Name Matching (${countMatched} matched${countAmbiguous > 0 ? `, ${countAmbiguous} need review` : ""})`,
                apply: "✅ Times & Apply",
              };
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 14px",
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
                    background: isActive ? "var(--cs-sand-mist)" : "transparent",
                    border: "none",
                    borderBottom: isActive ? "2px solid var(--cs-sand)" : "2px solid transparent",
                    cursor: "pointer",
                    borderRadius: "6px 6px 0 0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ── Tab: Preview ── */}
          {activeTab === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <SchedulePreviewCard
                  title="📴 Day-Off Schedule (Regular Staff)"
                  data={MANUAL_DAY_OFF_2026}
                  emptyLabel="No data"
                />
                <SchedulePreviewCard
                  title="💇 Salon Day-Off Schedule"
                  data={MANUAL_SALON_DAY_OFF_2026}
                  emptyLabel="No data"
                />
                <SchedulePreviewCard
                  title="🌅 Opening Duty Schedule"
                  data={MANUAL_OPENING_2026}
                  emptyLabel="No data"
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cs-btn cs-btn-primary cs-btn-sm"
                  onClick={() => setActiveTab("match")}
                >
                  Continue to Name Matching →
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Name Matching ── */}
          {activeTab === "match" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {/* Summary pills */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {[
                  { label: `${countMatched} matched`, color: "var(--cs-success,#27ae60)", bg: "rgba(39,174,96,0.08)" },
                  { label: `${countAmbiguous} need review`, color: "var(--cs-warning,#e67e22)", bg: "rgba(230,126,34,0.08)" },
                  { label: `${countNotFound} not found`, color: "var(--cs-error,#e74c3c)", bg: "rgba(231,76,60,0.08)" },
                  { label: `${countSkipped} skipped`, color: "var(--cs-text-muted)", bg: "var(--cs-surface-warm)" },
                ].map((pill) => (
                  <span
                    key={pill.label}
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: pill.color,
                      background: pill.bg,
                      padding: "3px 10px",
                      borderRadius: 12,
                      border: "1px solid transparent",
                    }}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>

              {/* Hint for unmatched */}
              {(countAmbiguous > 0 || countNotFound > 0) && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "rgba(230,126,34,0.05)",
                    border: "1px solid rgba(230,126,34,0.2)",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    color: "var(--cs-text-secondary)",
                  }}
                >
                  <strong style={{ color: "var(--cs-warning,#e67e22)" }}>Review required:</strong>
                  {" Select the correct staff record for ambiguous or not-found names, or skip them. Skipped names will not receive a schedule."}
                </div>
              )}

              {/* Matching table */}
              <div
                style={{
                  border: "1px solid var(--cs-border-soft)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "var(--cs-surface-warm)", borderBottom: "1px solid var(--cs-border-soft)" }}>
                      {["Paper Name", "Status", "Schedule Role", "Matched Staff", "Action"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            color: "var(--cs-text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchList.map((m, idx) => {
                      const summary = getNameScheduleSummary(m.paperName);
                      const roleParts: string[] = [];
                      if (summary.offDays.length > 0) {
                        roleParts.push(`Off: ${summary.offDays.map((d) => DAY_LABELS[d]).join(", ")}`);
                      }
                      if (summary.openingDays.length > 0) {
                        roleParts.push(`Opening: ${summary.openingDays.map((d) => DAY_LABELS[d]).join(", ")}`);
                      }

                      const displayName = m.paperName.charAt(0) + m.paperName.slice(1).toLowerCase();

                      return (
                        <tr
                          key={m.paperName}
                          style={{
                            borderBottom: idx < matchList.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
                            background: m.status === "skipped" ? "var(--cs-surface-warm)" : "transparent",
                            opacity: m.status === "skipped" ? 0.6 : 1,
                          }}
                        >
                          {/* Paper name */}
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--cs-text)" }}>
                            {displayName}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "8px 12px" }}>
                            <StatusBadge status={m.status} />
                          </td>

                          {/* Schedule role */}
                          <td style={{ padding: "8px 12px", color: "var(--cs-text-muted)", fontSize: "0.75rem", maxWidth: 200 }}>
                            {roleParts.length > 0 ? roleParts.join(" · ") : "Regular"}
                          </td>

                          {/* Matched staff */}
                          <td style={{ padding: "8px 12px" }}>
                            {m.status === "matched" && m.selectedId ? (
                              <span style={{ color: "var(--cs-text)", fontSize: "0.8125rem" }}>
                                {staff.find((s) => s.id === m.selectedId)?.full_name ?? m.selectedId}
                              </span>
                            ) : m.status === "ambiguous" || m.status === "unmatched" ? (
                              <select
                                value={m.selectedId ?? ""}
                                onChange={(e) => {
                                  if (e.target.value) handleSelectStaff(m.paperName, e.target.value);
                                }}
                                style={{
                                  height: 30,
                                  padding: "0 0.5rem",
                                  borderRadius: 6,
                                  border: "1px solid var(--cs-border)",
                                  background: "var(--cs-surface)",
                                  color: "var(--cs-text)",
                                  fontSize: "0.8125rem",
                                  minWidth: 200,
                                }}
                              >
                                <option value="">— select staff —</option>
                                {(m.status === "ambiguous" ? m.candidates : staff).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name}
                                    {s.nickname ? ` (${s.nickname})` : ""}
                                    {!s.is_active ? " [inactive]" : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ color: "var(--cs-text-muted)", fontStyle: "italic" }}>—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td style={{ padding: "8px 12px" }}>
                            {m.status !== "skipped" ? (
                              <button
                                type="button"
                                onClick={() => handleSkip(m.paperName)}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--cs-text-muted)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textDecoration: "underline",
                                }}
                              >
                                Skip
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUnskip(m.paperName)}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--cs-info,#2980b9)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textDecoration: "underline",
                                }}
                              >
                                Undo skip
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cs-btn cs-btn-primary cs-btn-sm"
                  onClick={() => setActiveTab("apply")}
                  disabled={unresolvedCritical.length > 0}
                >
                  {unresolvedCritical.length > 0
                    ? `Resolve ${unresolvedCritical.length} name(s) first`
                    : "Continue to Apply →"}
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Times & Apply ── */}
          {activeTab === "apply" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Time settings */}
              <div className="cs-card" style={{ padding: "1rem 1.125rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.75rem", fontFamily: "var(--font-display)" }}>
                  Shift Times
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                  {/* Regular shift */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>Regular Shift</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Applied to non-off, non-opening days</div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <TimeInput label="Start" value={times.regularStart} onChange={(v) => setTimes((t) => ({ ...t, regularStart: v }))} />
                      <TimeInput label="End" value={times.regularEnd} onChange={(v) => setTimes((t) => ({ ...t, regularEnd: v }))} />
                    </div>
                    {times.regularStart >= times.regularEnd && (
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-error,#e74c3c)" }}>Start must be before end</span>
                    )}
                  </div>

                  {/* Opening shift */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>Opening Shift</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Applied on opening-duty days</div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <TimeInput label="Start" value={times.openingStart} onChange={(v) => setTimes((t) => ({ ...t, openingStart: v }))} />
                      <TimeInput label="End" value={times.openingEnd} onChange={(v) => setTimes((t) => ({ ...t, openingEnd: v }))} />
                    </div>
                    {times.openingStart >= times.openingEnd && (
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-error,#e74c3c)" }}>Start must be before end</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Conflict detection */}
              {staffConflicts.length > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(231,76,60,0.06)",
                    border: "1px solid rgba(231,76,60,0.25)",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    color: "var(--cs-text-secondary)",
                  }}
                >
                  <strong style={{ color: "var(--cs-error,#e74c3c)" }}>⚠️ Critical conflicts detected:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 3 }}>
                    {staffConflicts.map(({ name, day }) => (
                      <li key={`${name}-${day}`} style={{ fontSize: "0.75rem" }}>
                        <strong>{name.charAt(0) + name.slice(1).toLowerCase()}</strong> is both opening and off on{" "}
                        <strong>{DAY_LABELS[day]}</strong>. Resolve in the Name Matching tab.
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary before apply */}
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--cs-surface-warm)",
                  border: "1px solid var(--cs-border-soft)",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  color: "var(--cs-text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "var(--cs-text)" }}>Ready to apply:</strong>
                {` ${resolvedMatches.length} staff member${resolvedMatches.length !== 1 ? "s" : ""} will receive a full 7-day weekly schedule. `}
                {countSkipped > 0 && `${countSkipped} name(s) skipped. `}
                {"Existing schedule rows for these staff will be overwritten."}
              </div>

              {/* Result feedback */}
              {result && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: result.ok ? "rgba(39,174,96,0.06)" : "rgba(231,76,60,0.06)",
                    border: `1px solid ${result.ok ? "rgba(39,174,96,0.25)" : "rgba(231,76,60,0.25)"}`,
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    color: result.ok ? "var(--cs-success,#27ae60)" : "var(--cs-error,#e74c3c)",
                    fontWeight: 600,
                  }}
                >
                  {result.ok
                    ? `✓ Schedule applied — ${result.staffCount} staff × 7 days = ${result.rowsWritten} schedule rows saved.`
                    : `✗ ${result.error}`}
                </div>
              )}

              {/* Apply button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="cs-btn cs-btn-secondary cs-btn-sm"
                  onClick={() => setActiveTab("match")}
                >
                  ← Back to Matching
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn-primary"
                  onClick={handleApply}
                  disabled={!canApply || isPending || result?.ok === true}
                  style={{ opacity: !canApply || isPending ? 0.55 : 1 }}
                >
                  {isPending
                    ? "Applying…"
                    : result?.ok
                      ? "✓ Applied"
                      : `Apply Schedule (${resolvedMatches.length} staff)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
