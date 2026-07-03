"use client";

import { StaffScheduleRow } from "./staff-schedule-row";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { Users } from "lucide-react";
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
  shift_type?: "single" | "opening" | "closing" | null;
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

export type StaffScheduleItem = {
  staff: StaffMember;
  schedules: Schedule[];
  overrides: ScheduleOverride[];
  blockedTimes: BlockedTime[];
};

type Props = {
  items: StaffScheduleItem[];
  rulesByGroup?: Record<string, StaffGroupScheduleRule[]>;
  onManage: (staffId: string) => void;
};

export function StaffScheduleList({ items, rulesByGroup, onManage }: Props) {
  if (items.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--cs-r-lg)",
        }}
      >
        <EmptyState
          title="No staff found"
          description="Try adjusting your search or filters."
          icon={<Users size={20} />}
        />
      </div>
    );
  }

  return (
    <div
      className="cs-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.25fr 1.5fr 0.7fr 0.7fr 0.6fr 90px",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 1.25rem",
          backgroundColor: "var(--cs-surface-warm)",
          borderBottom: "1px solid var(--cs-border-soft)",
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <div>Staff</div>
        <div>Role / Tier</div>
        <div>Weekly Hours</div>
        <div style={{ textAlign: "center" }}>Overrides</div>
        <div style={{ textAlign: "center" }}>Blocks</div>
        <div>Status</div>
        <div style={{ textAlign: "right" }}>Action</div>
      </div>

      {/* Rows */}
      <div>
        {items.map((item) => (
          <StaffScheduleRow
            key={item.staff.id}
            staff={item.staff}
            schedules={item.schedules}
            overrides={item.overrides}
            blockedTimes={item.blockedTimes}
            rulesByGroup={rulesByGroup}
            onManage={() => onManage(item.staff.id)}
          />
        ))}
      </div>
    </div>
  );
}
