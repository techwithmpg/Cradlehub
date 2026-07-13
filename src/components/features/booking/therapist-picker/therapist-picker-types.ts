export type TherapistPickerValue = "auto" | string;

export type TherapistPickerOption = {
  id: string | null;
  fullName: string;
  displayName: string;
  nickname?: string | null;
  initials: string;
  availabilityLabel: string;
  isAvailable: boolean;
  isRecommended?: boolean;
  isAnyProvider?: boolean;
  avatarUrl?: string | null;
};

export type TherapistPickerStaff = {
  staff_id: string;
  staff_name: string;
  staff_full_name?: string | null;
  staff_nickname?: string | null;
  staff_avatar_url?: string | null;
  staff_tier: string;
  staff_type?: string;
  staff_schedule_available?: boolean;
};
