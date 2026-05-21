"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffWeeklyHoursEditor } from "./staff-weekly-hours-editor";
import { StaffDayOverridesEditor } from "./staff-day-overrides-editor";
import { StaffBlockTimeEditor } from "./staff-block-time-editor";
import { summarizeWeeklyHours } from "@/lib/utils/staff-schedule-summary";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { Clock, CalendarDays, ShieldAlert } from "lucide-react";

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
  nickname?: string | null;
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
  onSave?: () => void;
};

function StatusBadge({ active, scheduled }: { active: boolean; scheduled: boolean }) {
  if (!active) {
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
  if (scheduled) {
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

function DayDot({ label, hasSchedule }: { label: string; hasSchedule: boolean }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        backgroundColor: hasSchedule ? "var(--cs-success-bg)" : "var(--cs-border-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        color: hasSchedule ? "var(--cs-success)" : "var(--cs-text-subtle)",
      }}
    >
      {label}
    </div>
  );
}

export function StaffScheduleDetailPanel({
  staff,
  schedules,
  overrides,
  blockedTimes,
  open,
  onOpenChange,
  onSave,
}: Props) {
  const [tab, setTab] = useState<"weekly" | "override" | "block">("weekly");

  if (!staff) return null;

  const summary = summarizeWeeklyHours(schedules);
  const isScheduled = schedules.some((s) => s.is_active);
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? staff.staff_type ?? "Staff";
  const displayName = getStaffAdminName(staff);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ maxWidth: 560, width: "100%", padding: 0 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "var(--cs-surface-warm)",
          }}
        >
          {/* Header */}
          <SheetHeader
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  backgroundColor: avatarColor.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 600,
                  color: avatarColor.text,
                  flexShrink: 0,
                }}
              >
                {displayName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SheetTitle
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "1.125rem",
                    color: "var(--cs-text)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {displayName}
                </SheetTitle>
                <SheetDescription
                  style={{
                    color: "var(--cs-text-muted)",
                    fontSize: "0.8125rem",
                    margin: 0,
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{roleLabel}</span>
                  {staff.is_head && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        background: "var(--cs-sand-mist)",
                        color: "var(--cs-sand-dark)",
                        borderRadius: "var(--cs-r-pill)",
                      }}
                    >
                      Head
                    </span>
                  )}
                  {staff.tier && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        background: "var(--cs-bg)",
                        color: "var(--cs-text-muted)",
                        borderRadius: "var(--cs-r-pill)",
                      }}
                    >
                      {staff.tier}
                    </span>
                  )}
                  <StatusBadge active={staff.is_active} scheduled={isScheduled} />
                </SheetDescription>
              </div>
            </div>

            {/* Schedule summary + day dots */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} style={{ color: "var(--cs-text-subtle)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", fontWeight: 500 }}>
                  {summary}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {DAY_NAMES.map((day, idx) => {
                  const hasSchedule = schedules.some((s) => s.day_of_week === idx && s.is_active);
                  return <DayDot key={idx} label={day} hasSchedule={hasSchedule} />;
                })}
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <div style={{ padding: "12px 24px 0", background: "var(--cs-surface)" }}>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "weekly" | "override" | "block")}>
              <TabsList
                variant="line"
                className="h-10 min-w-max justify-start rounded-none border-b border-[var(--cs-border-soft)] p-0 w-full"
              >
                <TabsTrigger
                  value="weekly"
                  className="h-10 flex-1 rounded-none px-3 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
                >
                  <Clock size={13} style={{ marginRight: 5, opacity: 0.7 }} />
                  Weekly Hours
                </TabsTrigger>
                <TabsTrigger
                  value="override"
                  className="h-10 flex-1 rounded-none px-3 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
                >
                  <CalendarDays size={13} style={{ marginRight: 5, opacity: 0.7 }} />
                  Day Overrides
                </TabsTrigger>
                <TabsTrigger
                  value="block"
                  className="h-10 flex-1 rounded-none px-3 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
                >
                  <ShieldAlert size={13} style={{ marginRight: 5, opacity: 0.7 }} />
                  Block Time
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 24px 24px",
            }}
          >
            {tab === "weekly" && (
              <StaffWeeklyHoursEditor
                staffId={staff.id}
                existingSchedules={schedules}
                onSave={onSave}
              />
            )}
            {tab === "override" && (
              <StaffDayOverridesEditor
                staffId={staff.id}
                staffName={displayName}
                existingOverrides={overrides}
                onSave={onSave}
              />
            )}
            {tab === "block" && (
              <StaffBlockTimeEditor
                staffId={staff.id}
                existingBlockedTimes={blockedTimes}
                onSave={onSave}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
