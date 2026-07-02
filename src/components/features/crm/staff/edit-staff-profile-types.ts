import { canonicalizeSystemRole } from "@/constants/staff";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { Database } from "@/types/supabase";

export type StaffProfileTab = "profile" | "work" | "access" | "services";

export type StaffProfileDraft = {
  fullName: string;
  nickname: string;
  phone: string;
  branchId: string;
  staffType: string;
  tier: string;
  isHead: boolean;
  systemRole: string;
  isActive: boolean;
};

export type StaffProfileBranch = {
  id: string;
  name: string;
};

export type StaffProfileService = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

export function createStaffProfileDraft(
  staffMember: StaffMember
): StaffProfileDraft {
  return {
    fullName: staffMember.full_name,
    nickname: staffMember.nickname ?? "",
    phone: staffMember.phone ?? "",
    branchId: staffMember.branch_id ?? "",
    staffType: staffMember.staff_type ?? "therapist",
    tier: staffMember.tier ?? "n/a",
    isHead: Boolean(staffMember.is_head),
    systemRole: canonicalizeSystemRole(staffMember.system_role),
    isActive: Boolean(staffMember.is_active),
  };
}

export function countStaffProfileChanges(
  initial: StaffProfileDraft,
  draft: StaffProfileDraft
): number {
  const fields: Array<keyof StaffProfileDraft> = [
    "fullName",
    "nickname",
    "phone",
    "branchId",
    "staffType",
    "tier",
    "isHead",
    "systemRole",
    "isActive",
  ];

  return fields.reduce(
    (count, field) => (initial[field] === draft[field] ? count : count + 1),
    0
  );
}
