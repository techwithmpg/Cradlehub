export type StaffScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type?: string;
  window_order?: number | null;
  ends_next_day?: boolean | null;
  created_at?: string | null;
};

export type ScheduleOverride = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  shift_type?: "single" | "opening" | "closing" | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export type BlockedTime = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

export type StaffScheduleMember = {
  id: string;
  full_name: string;
  nickname?: string | null;
  avatar_url?: string | null;
  tier: string | null;
  staff_type: string | null;
  system_role?: string | null;
  is_head: boolean | null;
  is_active: boolean;
};

export type StaffScheduleItem = {
  staff: StaffScheduleMember;
  schedules: StaffScheduleRow[];
  overrides: ScheduleOverride[];
  blockedTimes: BlockedTime[];
};
