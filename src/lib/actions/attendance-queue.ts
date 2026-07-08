"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type AttendanceQueueSuggestion = {
  staffId: string;
  fullName: string;
  nickname: string | null;
  queuePosition: number;
  checkedInAt: string | null;
};

export async function getAttendanceQueueSuggestionAction(
  rawInput: unknown
): Promise<
  | { success: true; suggestion: AttendanceQueueSuggestion | null }
  | { success: false; error: string }
> {
  const parsed = (typeof rawInput === "object" && rawInput !== null)
    ? (rawInput as { branchId?: string; date?: string; serviceId?: string | null })
    : {};

  if (!parsed.branchId || typeof parsed.branchId !== "string") {
    return { success: false, error: "Branch ID is required" };
  }
  if (!parsed.date || typeof parsed.date !== "string") {
    return { success: false, error: "Date is required" };
  }

  const admin = createAdminClient();

  // Fetch active staff for this branch
  const { data: staffRows, error: staffError } = await admin
    .from("staff")
    .select("id, full_name, nickname, staff_type, system_role, is_active")
    .eq("branch_id", parsed.branchId)
    .eq("is_active", true);

  if (staffError) return { success: false, error: staffError.message };

  const staffIds = (staffRows ?? []).map((s) => s.id);
  if (staffIds.length === 0) {
    return { success: true, suggestion: null };
  }

  // Fetch checked-in records for the date
  const { data: checkins, error: checkinsError } = await admin
    .from("staff_shift_checkins")
    .select("staff_id, checked_in_at, checked_out_at, status")
    .eq("branch_id", parsed.branchId)
    .eq("shift_date", parsed.date)
    .eq("status", "checked_in")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: true });

  if (checkinsError) return { success: false, error: checkinsError.message };

  const activeCheckinByStaffId = new Map(
    (checkins ?? []).map((c, index) => [c.staff_id, { ...c, queuePosition: index + 1 }])
  );

  // Filter to staff that are checked in and (optionally) can perform the service
  let eligibleStaffIds = staffIds.filter((id) => activeCheckinByStaffId.has(id));

  if (parsed.serviceId && eligibleStaffIds.length > 0) {
    const { data: mappings, error: mappingError } = await admin
      .from("staff_services")
      .select("staff_id, service_id")
      .in("staff_id", eligibleStaffIds)
      .eq("service_id", parsed.serviceId);

    if (mappingError) return { success: false, error: mappingError.message };

    const mappedStaffIds = new Set((mappings ?? []).map((m) => m.staff_id));

    // Also include staff whose staff_type implies service capability (fallback)
    const serviceableTypes = new Set([
      "therapist",
      "massage_therapist",
      "spa_therapist",
      "esthetician",
      "wellness_therapist",
    ]);

    eligibleStaffIds = eligibleStaffIds.filter((id) => {
      const staff = (staffRows ?? []).find((s) => s.id === id);
      if (!staff) return false;
      if (mappedStaffIds.has(id)) return true;
      const type = (staff.staff_type ?? "").toLowerCase();
      return Array.from(serviceableTypes).some((t) => type.includes(t));
    });
  }

  const topStaffId = eligibleStaffIds[0];
  if (!topStaffId) {
    return { success: true, suggestion: null };
  }

  const topStaff = (staffRows ?? []).find((s) => s.id === topStaffId);
  const checkin = activeCheckinByStaffId.get(topStaffId);

  if (!topStaff || !checkin) {
    return { success: true, suggestion: null };
  }

  return {
    success: true,
    suggestion: {
      staffId: topStaff.id,
      fullName: topStaff.full_name,
      nickname: topStaff.nickname,
      queuePosition: checkin.queuePosition,
      checkedInAt: checkin.checked_in_at,
    },
  };
}

export type AttendanceQueueStatus = {
  totalCheckedIn: number;
  nextUp: AttendanceQueueSuggestion | null;
};

export async function getAttendanceQueueStatusAction(
  rawInput: unknown
): Promise<
  | { success: true; data: AttendanceQueueStatus }
  | { success: false; error: string }
> {
  const parsed = (typeof rawInput === "object" && rawInput !== null)
    ? (rawInput as { branchId?: string; date?: string })
    : {};

  if (!parsed.branchId || typeof parsed.branchId !== "string") {
    return { success: false, error: "Branch ID is required" };
  }
  if (!parsed.date || typeof parsed.date !== "string") {
    return { success: false, error: "Date is required" };
  }

  const admin = createAdminClient();

  const { data: checkins, error: checkinsError } = await admin
    .from("staff_shift_checkins")
    .select("staff_id, checked_in_at, checked_out_at, status")
    .eq("branch_id", parsed.branchId)
    .eq("shift_date", parsed.date)
    .eq("status", "checked_in")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: true });

  if (checkinsError) return { success: false, error: checkinsError.message };

  const activeCheckins = checkins ?? [];
  if (activeCheckins.length === 0) {
    return { success: true, data: { totalCheckedIn: 0, nextUp: null } };
  }

  const nextUpId = activeCheckins[0]?.staff_id;
  let nextUp: AttendanceQueueSuggestion | null = null;

  if (nextUpId) {
    const { data: staffRow } = await admin
      .from("staff")
      .select("id, full_name, nickname")
      .eq("id", nextUpId)
      .maybeSingle();

    if (staffRow) {
      nextUp = {
        staffId: staffRow.id,
        fullName: staffRow.full_name,
        nickname: staffRow.nickname,
        queuePosition: 1,
        checkedInAt: activeCheckins[0]?.checked_in_at ?? null,
      };
    }
  }

  return {
    success: true,
    data: { totalCheckedIn: activeCheckins.length, nextUp },
  };
}
