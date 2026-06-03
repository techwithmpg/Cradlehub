"use client";

import { useState, useTransition, useMemo } from "react";
import { Save, RotateCcw, Clock, Users } from "lucide-react";
import { formatShiftTimeRange } from "@/lib/utils/time-format";
import {
  extractShiftTimes,
  computeOverlap,
  DEFAULT_SHIFT_TIMES,
  SCHEDULE_DAYS,
  SHIFT_STYLE,
  dayAbbr,
  formatDayList,
} from "./group-schedule-rules-panel";
import type { ShiftTimes, DayPattern } from "./group-schedule-rules-panel";
import { STAFF_GROUPS } from "./schedule-group-cards";
import { saveStaffWeeklyScheduleAction } from "@/app/(dashboard)/crm/staff-availability/actions";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyPattern(): Record<number, DayPattern> {
  return {
    0: { opening: false, closing: false, regular: false, dayOff: false },
    1: { opening: false, closing: false, regular: false, dayOff: false },
    2: { opening: false, closing: false, regular: false, dayOff: false },
    3: { opening: false, closing: false, regular: false, dayOff: false },
    4: { opening: false, closing: false, regular: false, dayOff: false },
    5: { opening: false, closing: false, regular: false, dayOff: false },
    6: { opening: false, closing: false, regular: false, dayOff: false },
  };
}

function schedulesToPattern(
  schedules: StaffScheduleItem["schedules"]
): Record<number, DayPattern> {
  const pattern = emptyPattern();

  // Group by day
  const byDay = new Map<number, typeof schedules>();
  for (const s of schedules) {
    const list = byDay.get(s.day_of_week) ?? [];
    list.push(s);
    byDay.set(s.day_of_week, list);
  }

  for (const [day, daySchedules] of byDay) {
    const p = pattern[day];
    if (!p) continue;
    const activeSchedules = daySchedules.filter((s) => s.is_active);

    if (daySchedules.length > 0 && activeSchedules.length === 0) {
      // All rows inactive → day off
      p.dayOff = true;
    } else {
      for (const s of activeSchedules) {
        if (s.shift_type === "opening") p.opening = true;
        else if (s.shift_type === "closing") p.closing = true;
        else if (s.shift_type === "single") p.regular = true;
      }
    }
  }

  return pattern;
}

function extractStaffTimesFromSchedules(
  schedules: StaffScheduleItem["schedules"]
): ShiftTimes {
  const times: ShiftTimes = {
    opening: { ...DEFAULT_SHIFT_TIMES.opening },
    closing: { ...DEFAULT_SHIFT_TIMES.closing },
    regular: { ...DEFAULT_SHIFT_TIMES.regular },
  };
  for (const s of schedules) {
    if (!s.is_active) continue;
    const start = s.start_time.slice(0, 5);
    const end = s.end_time.slice(0, 5);
    if (s.shift_type === "opening") times.opening = { start, end };
    else if (s.shift_type === "closing") times.closing = { start, end };
    else if (s.shift_type === "single") times.regular = { start, end };
  }
  return times;
}

function getStaffGroupKey(staffType: string | null): string {
  const group = STAFF_GROUPS.find((g) =>
    g.staffTypes.includes((staffType ?? "") as never)
  );
  return group?.id ?? "therapist";
}

// ── Sub-component: editor (keyed by staffId so it resets on selection change) ──

type EditorProps = {
  item: StaffScheduleItem;
  groupRules: StaffGroupScheduleRule[];
  branchId: string;
};

function StaffScheduleEditor({ item, groupRules, branchId }: EditorProps) {
  const groupTimes = useMemo(() => extractShiftTimes(groupRules), [groupRules]);

  const [pattern, setPattern] = useState<Record<number, DayPattern>>(() =>
    schedulesToPattern(item.schedules)
  );
  const [useGroupTimes, setUseGroupTimes] = useState(
    () => item.schedules.filter((s) => s.is_active).length === 0
  );
  const [customTimes, setCustomTimes] = useState<ShiftTimes>(() =>
    extractStaffTimesFromSchedules(item.schedules)
  );
  const [editingCustomTimes, setEditingCustomTimes] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeTimes = useGroupTimes ? groupTimes : customTimes;

  const toggle = (dow: number, field: keyof DayPattern) => {
    setPattern((prev) => ({
      ...prev,
      [dow]: { ...prev[dow]!, [field]: !prev[dow]![field] },
    }));
    setDirty(true);
  };

  const resetPattern = () => {
    setPattern(schedulesToPattern(item.schedules));
    setCustomTimes(extractStaffTimesFromSchedules(item.schedules));
    setUseGroupTimes(item.schedules.filter((s) => s.is_active).length === 0);
    setEditingCustomTimes(false);
    setDirty(false);
  };

  const save = () => {
    startTransition(async () => {
      const days = SCHEDULE_DAYS.map(({ dow }) => {
        const p = pattern[dow] ?? {
          opening: false,
          closing: false,
          regular: false,
          dayOff: false,
        };
        return {
          dayOfWeek: dow,
          opening: p.opening,
          closing: p.closing,
          regular: p.regular,
          dayOff: p.dayOff,
        };
      });

      const result = await saveStaffWeeklyScheduleAction({
        staffId: item.staff.id,
        branchId,
        days,
        times: activeTimes,
      });

      if (result.ok) {
        setFeedback({ ok: true, message: `Saved — ${result.rowsWritten} schedule rows updated.` });
        setDirty(false);
        setEditingCustomTimes(false);
      } else {
        setFeedback({ ok: false, message: result.error });
      }

      window.setTimeout(() => setFeedback(null), 4000);
    });
  };

  // Derived summary data
  const summaryRows = [
    {
      label: "Opening Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.opening).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(activeTimes.opening.start, activeTimes.opening.end),
      dot: "var(--cs-success)",
    },
    {
      label: "Closing Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.closing).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(activeTimes.closing.start, activeTimes.closing.end),
      dot: "var(--cs-info)",
    },
    {
      label: "Regular Shift",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.regular).map((d) => dayAbbr(d.label))
      ),
      time: formatShiftTimeRange(activeTimes.regular.start, activeTimes.regular.end),
      dot: "var(--cs-sand)",
    },
    {
      label: "Day Off",
      days: formatDayList(
        SCHEDULE_DAYS.filter((d) => pattern[d.dow]?.dayOff).map((d) => dayAbbr(d.label))
      ),
      time: "All day",
      dot: "var(--cs-text-subtle)",
    },
  ];

  const hasOpening = SCHEDULE_DAYS.some((d) => pattern[d.dow]?.opening);
  const hasClosing = SCHEDULE_DAYS.some((d) => pattern[d.dow]?.closing);
  const hasOverlap = hasOpening && hasClosing;
  const overlapLabel = hasOverlap
    ? computeOverlap(activeTimes.opening, activeTimes.closing)
    : null;

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "16px 20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
            {item.staff.full_name}
            {item.staff.nickname ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--cs-text-muted)",
                  marginLeft: 6,
                }}
              >
                &ldquo;{item.staff.nickname}&rdquo;
              </span>
            ) : null}
          </h3>
          <p
            style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 4, marginBottom: 0 }}
          >
            {item.staff.tier ?? "—"} · {item.staff.staff_type ?? "therapist"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {dirty && (
            <>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="cs-btn cs-btn-primary cs-btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Save size={13} />
                Save
              </button>
              <button
                type="button"
                onClick={resetPattern}
                disabled={isPending}
                className="cs-btn cs-btn-secondary cs-btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: "var(--cs-r-sm)",
            fontSize: 12,
            fontWeight: 500,
            background: feedback.ok ? "var(--cs-success-bg)" : "var(--cs-error-bg)",
            color: feedback.ok ? "var(--cs-success-text)" : "var(--cs-error-text)",
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Times source toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)" }}>
          Shift times:
        </span>
        <button
          type="button"
          onClick={() => {
            setUseGroupTimes(true);
            setEditingCustomTimes(false);
            setDirty(true);
          }}
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: "var(--cs-r-pill)",
            border: useGroupTimes ? "1px solid var(--cs-sand)" : "1px solid var(--cs-border)",
            background: useGroupTimes ? "var(--cs-sand-tint)" : "transparent",
            color: useGroupTimes ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Group default
        </button>
        <button
          type="button"
          onClick={() => {
            setUseGroupTimes(false);
            setDirty(true);
          }}
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: "var(--cs-r-pill)",
            border: !useGroupTimes ? "1px solid var(--cs-info)" : "1px solid var(--cs-border)",
            background: !useGroupTimes ? "rgba(37,99,235,0.08)" : "transparent",
            color: !useGroupTimes ? "#2563EB" : "var(--cs-text-muted)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Custom
        </button>
        {!useGroupTimes && (
          <button
            type="button"
            onClick={() => setEditingCustomTimes((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: editingCustomTimes
                ? "1px solid var(--cs-sand)"
                : "1px solid var(--cs-border)",
              background: editingCustomTimes ? "var(--cs-sand-tint)" : "transparent",
              color: editingCustomTimes ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            <Clock size={11} />
            {editingCustomTimes ? "Done" : "Edit times"}
          </button>
        )}

        {/* Show active times preview when not editing */}
        {!editingCustomTimes && (
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 4 }}
          >
            {(["opening", "closing", "regular"] as const).map((k) => {
              const s = SHIFT_STYLE[k] ?? SHIFT_STYLE.regular!;
              const t = activeTimes[k];
              return (
                <span
                  key={k}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: "var(--cs-r-sm)",
                    background: s.bg,
                    color: s.badge,
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: s.dot,
                      display: "inline-block",
                    }}
                  />
                  {formatShiftTimeRange(t.start, t.end)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom time inputs */}
      {!useGroupTimes && editingCustomTimes && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            background: "var(--cs-surface-warm)",
            borderRadius: "var(--cs-r-md)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--cs-text)",
              marginBottom: 10,
            }}
          >
            Custom times — saved with this staff member&apos;s schedule only
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["opening", "closing", "regular"] as const).map((k) => {
              const label =
                k === "opening" ? "Opening" : k === "closing" ? "Closing" : "Regular";
              const t = customTimes[k];
              const s = SHIFT_STYLE[k] ?? SHIFT_STYLE.regular!;
              return (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.dot,
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--cs-text)",
                      minWidth: 70,
                    }}
                  >
                    {label}
                  </span>
                  <input
                    type="time"
                    value={t.start}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTimes((prev) => ({
                        ...prev,
                        [k]: { ...prev[k], start: val },
                      }));
                      setDirty(true);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "3px 8px",
                      borderRadius: "var(--cs-r-sm)",
                      border: "1px solid var(--cs-border)",
                      background: "var(--cs-surface)",
                      color: "var(--cs-text)",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>–</span>
                  <input
                    type="time"
                    value={t.end}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTimes((prev) => ({
                        ...prev,
                        [k]: { ...prev[k], end: val },
                      }));
                      setDirty(true);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "3px 8px",
                      borderRadius: "var(--cs-r-sm)",
                      border: "1px solid var(--cs-border)",
                      background: "var(--cs-surface)",
                      color: "var(--cs-text)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Pattern heading */}
      <div style={{ marginBottom: 4 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}
        >
          Weekly Pattern
        </div>
        {dirty && (
          <div
            style={{
              fontSize: 10,
              color: "var(--cs-sand-dark)",
              background: "var(--cs-sand-mist)",
              borderRadius: "var(--cs-r-sm)",
              padding: "5px 10px",
              marginBottom: 8,
              display: "inline-block",
            }}
          >
            Unsaved changes — click Save to apply.
          </div>
        )}
      </div>

      {/* Matrix */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 1fr 1fr 1fr",
            minWidth: 380,
          }}
        >
          {["Day", "Opening", "Closing", "Regular", "Day Off"].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "6px 4px",
                borderBottom: "1px solid var(--cs-border)",
              }}
            >
              {h}
            </div>
          ))}
          {SCHEDULE_DAYS.map(({ dow, label }, rowIdx) => {
            const dp = pattern[dow] ?? {
              opening: false,
              closing: false,
              regular: false,
              dayOff: false,
            };
            const border =
              rowIdx < SCHEDULE_DAYS.length - 1
                ? "1px solid var(--cs-border-soft)"
                : "none";
            return (
              <div key={dow} style={{ display: "contents" }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--cs-text)",
                    padding: "8px 4px",
                    borderBottom: border,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {label}
                </div>
                {(["opening", "closing", "regular", "dayOff"] as const).map((field) => (
                  <div
                    key={`${dow}-${field}`}
                    style={{
                      padding: "8px 4px",
                      borderBottom: border,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={dp[field]}
                      onChange={() => toggle(dow, field)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Summary */}
      <div
        style={{
          marginTop: "1rem",
          padding: 12,
          background: "var(--cs-surface-warm)",
          borderRadius: "var(--cs-r-md)",
          border: "1px solid var(--cs-border-soft)",
        }}
      >
        <div
          style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 6 }}
        >
          Schedule Summary
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {summaryRows.map((row, idx) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "3px 0",
                borderBottom:
                  idx < summaryRows.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: row.dot,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text)", width: 90 }}
              >
                {row.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--cs-text-muted)", flex: 1 }}>
                {row.days}
              </span>
              <span
                style={{ fontSize: 11, color: "var(--cs-text-subtle)", whiteSpace: "nowrap" }}
              >
                {row.time}
              </span>
            </div>
          ))}
        </div>

        {hasOverlap && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              background: "var(--cs-success-bg)",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid rgba(90,138,106,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-success)" }}>
                Overlap Window
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  background: "var(--cs-success)",
                  color: "#fff",
                  borderRadius: "var(--cs-r-pill)",
                }}
              >
                High Coverage
              </span>
            </div>
            {overlapLabel ? (
              <span style={{ fontSize: 11, color: "var(--cs-text)" }}>{overlapLabel}</span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
                No overlap — opening and closing shifts don&apos;t share any hours
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main card component ────────────────────────────────────────────────────────

type Props = {
  items: StaffScheduleItem[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
  branchId: string;
};

export function StaffScheduleCard({ items, rulesByGroup, branchId }: Props) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [search, setSearch] = useState("");

  // Filter items by search
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.staff.full_name.toLowerCase().includes(q) ||
        (i.staff.nickname ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const selectedItem = items.find((i) => i.staff.id === selectedStaffId);

  // Derive group rules for selected staff
  const groupRules = useMemo(() => {
    if (!selectedItem) return [];
    const groupKey = getStaffGroupKey(selectedItem.staff.staff_type);
    return rulesByGroup[groupKey] ?? [];
  }, [selectedItem, rulesByGroup]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Staff picker */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Users size={16} style={{ color: "var(--cs-sand)" }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
            Staff Schedule
          </h2>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--cs-text-muted)",
            marginTop: 0,
            marginBottom: 14,
          }}
        >
          Select a staff member to view and edit their personal weekly schedule. Custom schedules
          override the group default for booking and availability checks.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              color: "var(--cs-text)",
              width: 200,
            }}
          />

          {/* Staff selector */}
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              color: "var(--cs-text)",
              minWidth: 220,
              flex: 1,
              maxWidth: 340,
            }}
          >
            <option value="">— Select staff member —</option>
            {filteredItems.map((i) => (
              <option key={i.staff.id} value={i.staff.id}>
                {i.staff.full_name}
                {i.staff.nickname ? ` (${i.staff.nickname})` : ""}
                {!i.staff.is_active ? " [inactive]" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Quick stats for selected staff */}
        {selectedItem && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Active schedules",
                value: selectedItem.schedules.filter((s) => s.is_active).length,
              },
              { label: "Overrides", value: selectedItem.overrides.length },
              { label: "Blocked times", value: selectedItem.blockedTimes.length },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  fontSize: 11,
                  color: "var(--cs-text-muted)",
                  display: "flex",
                  gap: 4,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--cs-text)",
                  }}
                >
                  {stat.value}
                </span>
                {stat.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor — keyed by staffId so it resets on selection change */}
      {!selectedItem && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: 13,
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-lg)",
          }}
        >
          Select a staff member above to edit their schedule.
        </div>
      )}

      {selectedItem && (
        <StaffScheduleEditor
          key={selectedItem.staff.id}
          item={selectedItem}
          groupRules={groupRules}
          branchId={branchId}
        />
      )}
    </div>
  );
}
