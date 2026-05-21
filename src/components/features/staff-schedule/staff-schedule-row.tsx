"use client";

import { summarizeWeeklyHours, SHIFT_LABELS } from "@/lib/utils/staff-schedule-summary";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { getStaffScheduleSource } from "@/lib/schedule/effective-schedule";
import { Settings2 } from "lucide-react";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type?: string;
};

type ScheduleOverride = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockedTime = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  nickname?: string | null;
  tier: string | null;
  staff_type: string | null;
  is_head: boolean | null;
  is_active: boolean;
};

type Props = {
  staff: StaffMember;
  schedules: Schedule[];
  overrides: ScheduleOverride[];
  blockedTimes: BlockedTime[];
  rulesByGroup?: Record<string, StaffGroupScheduleRule[]>;
  onManage: () => void;
};

const SHIFT_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  opening: { bg: "rgba(74, 124, 89, 0.12)", color: "#4A7C59" },
  closing: { bg: "rgba(37, 99, 235, 0.12)", color: "#2563EB" },
  single:  { bg: "rgba(166, 123, 91, 0.12)", color: "var(--cs-sand-dark)" },
};

function ShiftBadge({ type }: { type: string }) {
  const style = SHIFT_BADGE_COLORS[type] ?? SHIFT_BADGE_COLORS.single!;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--cs-r-pill)",
        fontSize: 10,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {SHIFT_LABELS[type] ?? type}
    </span>
  );
}

function StatusChip({ staff, isScheduled }: { staff: StaffMember; isScheduled: boolean }) {
  if (!staff.is_active) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: "var(--cs-r-pill)",
          fontSize: 11,
          fontWeight: 600,
          background: "var(--cs-error-bg)",
          color: "var(--cs-error)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cs-error)" }} />
        Inactive
      </span>
    );
  }

  if (isScheduled) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: "var(--cs-r-pill)",
          fontSize: 11,
          fontWeight: 600,
          background: "var(--cs-success-bg)",
          color: "var(--cs-success)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cs-success)" }} />
        Scheduled
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: "var(--cs-r-pill)",
        fontSize: 11,
        fontWeight: 600,
        background: "var(--cs-neutral-bg)",
        color: "var(--cs-neutral)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cs-neutral)" }} />
      Off
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        background: count > 0 ? "var(--cs-sand-mist)" : "transparent",
        color: count > 0 ? "var(--cs-sand-dark)" : "var(--cs-text-subtle)",
      }}
    >
      {count}
    </span>
  );
}

function SourceBadge({ sourceInfo }: { sourceInfo: { label: string; color: string; bg: string } }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--cs-r-pill)",
        fontSize: 10,
        fontWeight: 600,
        background: sourceInfo.bg,
        color: sourceInfo.color,
        whiteSpace: "nowrap",
      }}
    >
      {sourceInfo.label}
    </span>
  );
}

export function StaffScheduleRow({ staff, schedules, overrides, blockedTimes, rulesByGroup, onManage }: Props) {
  const summary = summarizeWeeklyHours(schedules);
  const isScheduled = schedules.some((s) => s.is_active);

  // Collect unique active shift types across all scheduled days
  const activeShiftTypes = Array.from(
    new Set(schedules.filter((s) => s.is_active).map((s) => s.shift_type ?? "single"))
  );
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? staff.staff_type ?? "Staff";
  const displayName = getStaffAdminName(staff);

  // Resolve group rules for this staff
  const staffType = staff.staff_type ?? "";
  const groupKey =
    staffType === "therapist" ? "therapist"
    : staffType === "driver" ? "driver"
    : staffType === "csr" ? "csr"
    : staffType === "utility" ? "utility"
    : staffType === "managerial" ? "managerial"
    : staffType === "nail_tech" || staffType === "salon_head" ? "nail_tech"
    : staffType === "aesthetician" ? "aesthetician"
    : "";
  const groupRules = groupKey ? (rulesByGroup?.[groupKey] ?? []) : [];
  const sourceInfo = getStaffScheduleSource({ staff, schedules, overrides, blockedTimes }, groupRules);

  // Avatar color based on name
  const avatarColors = [
    { bg: "#E8DDD5", text: "#8A6347" },
    { bg: "#D5E8DD", text: "#4A7C59" },
    { bg: "#DDD5E8", text: "#6A4A8A" },
    { bg: "#E8E8D5", text: "#8A7A5A" },
    { bg: "#D5DDE8", text: "#5A6A8A" },
  ];
  const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length]!;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onManage}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onManage();
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.25fr 1.5fr 0.7fr 0.7fr 0.6fr 90px",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 1.25rem",
        borderBottom: "1px solid var(--cs-border-soft)",
        cursor: "pointer",
        transition: "background-color 120ms ease",
        backgroundColor: "var(--cs-surface)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--cs-surface-warm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--cs-surface)";
      }}
    >
      {/* Staff */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            backgroundColor: avatarColor.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: avatarColor.text,
            flexShrink: 0,
          }}
        >
          {displayName.charAt(0)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--cs-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <SourceBadge sourceInfo={sourceInfo} />
          </div>
        </div>
      </div>

      {/* Role / Tier */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {roleLabel}
        {staff.is_head && (
          <span style={{ color: "var(--cs-sand)", fontWeight: 500 }}> · Head</span>
        )}
        {staff.tier && ` · ${staff.tier}`}
      </div>

      {/* Weekly Hours Summary + Shift Badges */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: isScheduled ? "var(--cs-text)" : "var(--cs-text-muted)",
            fontWeight: isScheduled ? 500 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {summary}
        </div>
        {activeShiftTypes.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {activeShiftTypes.map((st) => (
              <ShiftBadge key={st} type={st} />
            ))}
          </div>
        )}
      </div>

      {/* Overrides */}
      <div style={{ textAlign: "center" }}>
        <CountBadge count={overrides.length} />
      </div>

      {/* Blocked Times */}
      <div style={{ textAlign: "center" }}>
        <CountBadge count={blockedTimes.length} />
      </div>

      {/* Status */}
      <div>
        <StatusChip staff={staff} isScheduled={isScheduled} />
      </div>

      {/* Action */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onManage();
          }}
          className="cs-btn cs-btn-secondary cs-btn-sm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 10px",
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          <Settings2 size={13} />
          Manage
        </button>
      </div>
    </div>
  );
}
