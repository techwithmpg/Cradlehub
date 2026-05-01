"use client";

import { summarizeWeeklyHours } from "@/lib/utils/staff-schedule-summary";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { Settings2 } from "lucide-react";

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
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
  onManage: () => void;
};

export function StaffScheduleRow({ staff, schedules, overrides, blockedTimes, onManage }: Props) {
  const summary = summarizeWeeklyHours(schedules);
  const isScheduled = schedules.some((s) => s.is_active);
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? staff.staff_type ?? "Staff";

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
        gridTemplateColumns: "1.75fr 1.25fr 1.5fr 0.6fr 0.6fr 0.5fr 80px",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 1rem",
        borderBottom: "1px solid var(--cs-border)",
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
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "var(--cs-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            flexShrink: 0,
          }}
        >
          {staff.full_name.charAt(0)}
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
            {staff.full_name}
          </div>
        </div>
      </div>

      {/* Role / Tier */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {roleLabel}
        {staff.is_head && " · Head"}
        {staff.tier && ` · ${staff.tier}`}
      </div>

      {/* Weekly Hours Summary */}
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

      {/* Overrides */}
      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
        {overrides.length}{" "}
        <span style={{ color: overrides.length > 0 ? "var(--cs-sand)" : "var(--cs-text-muted)" }}>
          override{overrides.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Blocked Times */}
      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
        {blockedTimes.length}{" "}
        <span style={{ color: blockedTimes.length > 0 ? "var(--cs-sand)" : "var(--cs-text-muted)" }}>
          block{blockedTimes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: staff.is_active ? (isScheduled ? "#4A7C59" : "#BDBDBD") : "#DC2626",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: staff.is_active ? (isScheduled ? "#4A7C59" : "var(--cs-text-muted)") : "#DC2626",
          }}
        >
          {staff.is_active ? (isScheduled ? "Scheduled" : "Off") : "Inactive"}
        </span>
      </div>

      {/* Action */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onManage();
          }}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage
        </button>
      </div>
    </div>
  );
}
