import type {
  TherapistPickerOption,
  TherapistPickerStaff,
  TherapistPickerValue,
} from "./therapist-picker-types";

export const ANY_PROVIDER_OPTION: TherapistPickerOption = {
  id: null,
  fullName: "Any available provider",
  displayName: "Any available provider",
  nickname: null,
  initials: "Any",
  availabilityLabel: "Recommended",
  isAvailable: true,
  isRecommended: true,
  isAnyProvider: true,
  avatarUrl: null,
};

export function getTherapistInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "";
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function getTherapistSubLabel(option: TherapistPickerOption): string {
  const identity = option.nickname?.trim() || option.initials;
  return `${identity} · ${option.availabilityLabel}`;
}

export function buildTherapistPickerOptions(
  staff: TherapistPickerStaff[],
  slotLabel: string
): TherapistPickerOption[] {
  const availabilityLabel = slotLabel ? `Available at ${slotLabel}` : "Available now";

  return staff.map((member, index) => {
    const fullName = member.staff_full_name?.trim() || member.staff_name;
    const displayName = fullName;
    const nickname = member.staff_nickname?.trim() || null;
    const initials = getTherapistInitials(nickname || fullName);

    return {
      id: member.staff_id,
      fullName,
      displayName,
      nickname,
      initials,
      availabilityLabel,
      isAvailable: true,
      isRecommended: index === 0,
      avatarUrl: member.staff_avatar_url ?? null,
    };
  });
}

export function getSelectedTherapistOption(
  options: TherapistPickerOption[],
  value: TherapistPickerValue
): TherapistPickerOption {
  if (value === "auto") return ANY_PROVIDER_OPTION;
  return options.find((option) => option.id === value) ?? ANY_PROVIDER_OPTION;
}
