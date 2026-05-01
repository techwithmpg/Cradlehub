"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StaffWeeklyHoursEditor } from "./staff-weekly-hours-editor";
import { StaffDayOverridesEditor } from "./staff-day-overrides-editor";
import { StaffBlockTimeEditor } from "./staff-block-time-editor";
import { summarizeWeeklyHours } from "@/lib/utils/staff-schedule-summary";
import { STAFF_TYPE_LABELS } from "@/constants/staff";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  staff: StaffMember | null;
  schedules: Schedule[];
  overrides: ScheduleOverride[];
  blockedTimes: BlockedTime[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StaffScheduleDetailPanel({
  staff,
  schedules,
  overrides,
  blockedTimes,
  open,
  onOpenChange,
}: Props) {
  const [tab, setTab] = useState<"weekly" | "override" | "block">("weekly");

  if (!staff) return null;

  const summary = summarizeWeeklyHours(schedules);
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? staff.staff_type ?? "Staff";

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "5px 12px",
      borderRadius: 5,
      border: `1px solid ${active ? "var(--cs-sand)" : "var(--cs-border)"}`,
      backgroundColor: active ? "var(--cs-sand-mist)" : "transparent",
      color: active ? "var(--cs-sand)" : "var(--cs-text-muted)",
      fontSize: "0.8125rem",
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
    };
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ maxWidth: 520, width: "100%" }}>
        <SheetHeader>
          <SheetTitle
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "1.125rem",
              color: "var(--cs-text)",
            }}
          >
            {staff.full_name}
          </SheetTitle>
          <SheetDescription style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>
            {roleLabel}
            {staff.is_head && " · Head"}
            {staff.tier && ` · ${staff.tier}`}
            {" · "}
            <span
              style={{
                color: staff.is_active ? "#4A7C59" : "var(--cs-text-muted)",
                fontWeight: 500,
              }}
            >
              {staff.is_active ? "Active" : "Inactive"}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div style={{ padding: "0 1rem 0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: schedules.some((s) => s.is_active) ? "#4A7C59" : "#BDBDBD",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-text)", fontWeight: 500 }}>
              {summary}
            </span>
          </div>

          {/* Day dots */}
          <div style={{ display: "flex", gap: 4, marginBottom: "1rem" }}>
            {DAY_NAMES.map((day, idx) => {
              const hasSchedule = schedules.some((s) => s.day_of_week === idx && s.is_active);
              return (
                <div
                  key={idx}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    backgroundColor: hasSchedule ? "var(--cs-sand-mist)" : "var(--cs-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    color: hasSchedule ? "var(--cs-sand)" : "var(--cs-text-muted)",
                  }}
                >
                  {day.charAt(0)}
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button type="button" style={tabStyle(tab === "weekly")} onClick={() => setTab("weekly")}>
              Weekly Hours
            </button>
            <button type="button" style={tabStyle(tab === "override")} onClick={() => setTab("override")}>
              Day Overrides
            </button>
            <button type="button" style={tabStyle(tab === "block")} onClick={() => setTab("block")}>
              Block Time
            </button>
          </div>

          {tab === "weekly" && (
            <StaffWeeklyHoursEditor staffId={staff.id} existingSchedules={schedules} />
          )}
          {tab === "override" && (
            <StaffDayOverridesEditor
              staffId={staff.id}
              staffName={staff.full_name}
              existingOverrides={overrides}
            />
          )}
          {tab === "block" && (
            <StaffBlockTimeEditor staffId={staff.id} existingBlockedTimes={blockedTimes} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
