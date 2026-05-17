export type StaffNameFields = {
  full_name?: string | null;
  nickname?: string | null;
};

function cleanName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getStaffNickname(staff: StaffNameFields): string | null {
  return cleanName(staff.nickname);
}

export function getStaffDisplayName(staff: StaffNameFields): string {
  return getStaffNickname(staff) ?? cleanName(staff.full_name) ?? "Unnamed staff";
}

export function getStaffAdminName(staff: StaffNameFields): string {
  const nickname = getStaffNickname(staff);
  const fullName = cleanName(staff.full_name);

  if (fullName && nickname) return `${fullName} (${nickname})`;
  return fullName ?? nickname ?? "Unnamed staff";
}

export function getStaffKnownAsLabel(staff: StaffNameFields): string | null {
  const nickname = getStaffNickname(staff);
  return nickname ? `Known as ${nickname}` : null;
}
