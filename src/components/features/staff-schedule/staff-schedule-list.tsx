"use client";

import { StaffScheduleRow } from "./staff-schedule-row";
import { EmptyState } from "@/components/features/dashboard/empty-state";

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

export type StaffScheduleItem = {
  staff: StaffMember;
  schedules: Schedule[];
  overrides: ScheduleOverride[];
  blockedTimes: BlockedTime[];
};

type Props = {
  items: StaffScheduleItem[];
  onManage: (staffId: string) => void;
};

export function StaffScheduleList({ items, onManage }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No staff found"
        description="Try adjusting your search or filters."
      />
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
          gridTemplateColumns: "1.75fr 1.25fr 1.5fr 0.6fr 0.6fr 0.5fr 80px",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          backgroundColor: "var(--cs-bg)",
          borderBottom: "1px solid var(--cs-border)",
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        <div>Staff</div>
        <div>Role / Tier</div>
        <div>Weekly Hours</div>
        <div>Overrides</div>
        <div>Blocks</div>
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
            onManage={() => onManage(item.staff.id)}
          />
        ))}
      </div>
    </div>
  );
}
