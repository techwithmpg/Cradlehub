"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";
import { resolveScheduleForStaffDay, dayOfWeekFromDateString } from "@/lib/schedule/resolve-staff-schedule";

export type ShiftSwapColleagueOption = {
  id: string;
  fullName: string;
  staffType: string | null;
  isWorkingThatDay: boolean;
  shiftSummary: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: string | null;
  endsNextDay: boolean;
};

export type PendingShiftSwapItem = {
  notificationId: string;
  direction: "incoming" | "outgoing";
  targetDate: string;
  requesterStaffId: string;
  requesterName: string;
  colleagueStaffId: string;
  colleagueName: string;
  requesterShiftSummary: string;
  colleagueShiftSummary: string;
  note: string | null;
  createdAt: string;
};

export type ShiftSwapContextResult =
  | {
      ok: true;
      myStaffId: string;
      myName: string;
      branchId: string;
      targetDate: string;
      myShift: {
        isWorking: boolean;
        summary: string;
        startTime: string | null;
        endTime: string | null;
        shiftType: string | null;
        endsNextDay: boolean;
      };
      colleagues: ShiftSwapColleagueOption[];
      pendingSwaps: PendingShiftSwapItem[];
    }
  | { ok: false; error: string };

function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [hStr = "0", mStr = "00"] = time.split(":");
  const h = Number(hStr);
  const m = mStr.slice(0, 2);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr12}:${m} ${suffix}`;
}

function summarizeResolvedSchedule(resolved: ReturnType<typeof resolveScheduleForStaffDay>): {
  isWorking: boolean;
  summary: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: string | null;
  endsNextDay: boolean;
} {
  if (!resolved.isWorking || resolved.isDayOff || resolved.windows.length === 0) {
    return {
      isWorking: false,
      summary: "Day Off",
      startTime: null,
      endTime: null,
      shiftType: null,
      endsNextDay: false,
    };
  }
  const first = resolved.windows[0]!;
  const last = resolved.windows[resolved.windows.length - 1]!;
  return {
    isWorking: true,
    summary: `${formatTime12h(first.startTime)} – ${formatTime12h(last.endTime)}`,
    startTime: first.startTime,
    endTime: last.endTime,
    shiftType: first.shiftType ?? "single",
    endsNextDay: Boolean(last.endsNextDay),
  };
}

async function getAuthenticatedStaff() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id, full_name, nickname, branch_id, system_role, staff_type, is_active")
    .eq("auth_user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  return staff;
}

export async function getShiftSwapContextAction(
  targetDate: string
): Promise<ShiftSwapContextResult> {
  const me = await getAuthenticatedStaff();
  if (!me || !me.branch_id) {
    return { ok: false, error: "Please sign in to your staff account." };
  }

  const admin = createAdminClient();
  const dayOfWeek = dayOfWeekFromDateString(targetDate);

  // Fetch active peers in the same branch + their schedules and overrides for targetDate
  const [peersResult, schedulesResult, overridesResult, pendingNotificationsResult] =
    await Promise.all([
      admin
        .from("staff")
        .select("id, full_name, nickname, staff_type, system_role, is_active")
        .eq("branch_id", me.branch_id)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      admin
        .from("staff_schedules")
        .select("id, staff_id, day_of_week, start_time, end_time, shift_type, is_active, window_order, ends_next_day")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true),
      admin
        .from("schedule_overrides")
        .select("id, staff_id, override_date, is_day_off, start_time, end_time, shift_type, ends_next_day, reason")
        .eq("override_date", targetDate),
      admin
        .from("workspace_notifications")
        .select("id, recipient_staff_id, actor_staff_id, created_at, metadata, status")
        .eq("branch_id", me.branch_id)
        .eq("type", "shift_swap_request")
        .in("status", ["unread", "read"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const allStaff = peersResult.data ?? [];
  const schedulesByStaff = new Map<string, typeof schedulesResult.data>();
  for (const row of schedulesResult.data ?? []) {
    const list = schedulesByStaff.get(row.staff_id) ?? [];
    list.push(row);
    schedulesByStaff.set(row.staff_id, list);
  }

  const overrideByStaff = new Map<string, NonNullable<typeof overridesResult.data>[number]>();
  for (const row of overridesResult.data ?? []) {
    overrideByStaff.set(row.staff_id, row);
  }

  const myResolved = resolveScheduleForStaffDay({
    override: overrideByStaff.get(me.id) ?? null,
    individualRows: schedulesByStaff.get(me.id) ?? [],
    staff: { system_role: me.system_role, staff_type: me.staff_type },
  });
  const myShift = summarizeResolvedSchedule(myResolved);

  // Filter eligible colleagues (same staff_type or same operational role)
  const colleagues: ShiftSwapColleagueOption[] = allStaff
    .filter((peer) => {
      if (peer.id === me.id) return false;
      const r = (peer.system_role || "").toLowerCase();
      if (r === "owner" || r === "super_admin" || r === "manager") return false;
      if (me.staff_type && peer.staff_type) {
        return me.staff_type === peer.staff_type;
      }
      return peer.system_role === me.system_role;
    })
    .map((peer) => {
      const resolved = resolveScheduleForStaffDay({
        override: overrideByStaff.get(peer.id) ?? null,
        individualRows: schedulesByStaff.get(peer.id) ?? [],
        staff: { system_role: peer.system_role, staff_type: peer.staff_type },
      });
      const summary = summarizeResolvedSchedule(resolved);
      return {
        id: peer.id,
        fullName: peer.full_name,
        staffType: peer.staff_type,
        isWorkingThatDay: summary.isWorking,
        shiftSummary: summary.summary,
        startTime: summary.startTime,
        endTime: summary.endTime,
        shiftType: summary.shiftType,
        endsNextDay: summary.endsNextDay,
      };
    });

  const pendingSwaps: PendingShiftSwapItem[] = [];
  for (const row of pendingNotificationsResult.data ?? []) {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const requesterStaffId = String(meta.requesterStaffId ?? row.actor_staff_id ?? "");
    const colleagueStaffId = String(meta.colleagueStaffId ?? row.recipient_staff_id ?? "");
    if (requesterStaffId !== me.id && colleagueStaffId !== me.id) continue;

    pendingSwaps.push({
      notificationId: row.id,
      direction: colleagueStaffId === me.id ? "incoming" : "outgoing",
      targetDate: String(meta.targetDate ?? targetDate),
      requesterStaffId,
      requesterName: String(meta.requesterName ?? "Colleague"),
      colleagueStaffId,
      colleagueName: String(meta.colleagueName ?? "Colleague"),
      requesterShiftSummary: String(meta.requesterShiftSummary ?? "Shift"),
      colleagueShiftSummary: String(meta.colleagueShiftSummary ?? "Day Off"),
      note: typeof meta.note === "string" ? meta.note : null,
      createdAt: row.created_at,
    });
  }

  return {
    ok: true,
    myStaffId: me.id,
    myName: me.full_name,
    branchId: me.branch_id,
    targetDate,
    myShift,
    colleagues,
    pendingSwaps,
  };
}

export async function requestPeerShiftSwapAction(input: {
  targetDate: string;
  colleagueStaffId: string;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getShiftSwapContextAction(input.targetDate);
  if (!ctx.ok) return { ok: false, message: ctx.error };

  const colleague = ctx.colleagues.find((c) => c.id === input.colleagueStaffId);
  if (!colleague) {
    return { ok: false, message: "Selected colleague is not available for a shift swap." };
  }

  if (!ctx.myShift.isWorking && !colleague.isWorkingThatDay) {
    return {
      ok: false,
      message: "Both you and your colleague are off on this date. At least one person must have a scheduled shift to swap.",
    };
  }

  const dateLabel = new Date(`${input.targetDate}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const swapMetadata = {
    swapRequest: true,
    targetDate: input.targetDate,
    dateLabel,
    requesterStaffId: ctx.myStaffId,
    requesterName: ctx.myName,
    requesterShift: ctx.myShift,
    requesterShiftSummary: ctx.myShift.summary,
    colleagueStaffId: colleague.id,
    colleagueName: colleague.fullName,
    colleagueShift: {
      isWorking: colleague.isWorkingThatDay,
      summary: colleague.shiftSummary,
      startTime: colleague.startTime,
      endTime: colleague.endTime,
      shiftType: colleague.shiftType,
      endsNextDay: colleague.endsNextDay,
    },
    colleagueShiftSummary: colleague.shiftSummary,
    note: input.note?.trim() || null,
  };

  const sent = await createOrUpdateNotification({
    branchId: ctx.branchId,
    targetWorkspace: "staff",
    recipientStaffId: colleague.id,
    actorStaffId: ctx.myStaffId,
    type: "shift_swap_request",
    title: `Shift Swap Request from ${ctx.myName}`,
    body: `${ctx.myName} (${ctx.myShift.summary}) wants to swap shifts with you (${colleague.shiftSummary}) on ${dateLabel}. Tap to accept or decline.`,
    entityType: "schedule",
    entityId: `${input.targetDate}:${ctx.myStaffId}:${colleague.id}`,
    actionHref: `/staff-portal/schedule?weekStart=${input.targetDate}`,
    priority: "high",
    requiresAction: true,
    dedupeKey: `shift-swap-req:${input.targetDate}:${ctx.myStaffId}:${colleague.id}`,
    metadata: swapMetadata,
  });

  if (!sent) {
    return { ok: false, message: "Could not send shift swap request. Please try again." };
  }

  revalidatePath("/staff-portal/schedule");
  revalidatePath("/staff/schedule");
  return {
    ok: true,
    message: `Swap request sent to ${colleague.fullName}! They will receive an instant push notification to accept.`,
  };
}

export async function respondToPeerShiftSwapAction(input: {
  notificationId: string;
  decision: "accept" | "decline";
}): Promise<{ ok: boolean; message: string }> {
  const me = await getAuthenticatedStaff();
  if (!me || !me.branch_id) {
    return { ok: false, message: "Please sign in to respond to this swap request." };
  }

  const admin = createAdminClient();
  const { data: notification } = await admin
    .from("workspace_notifications")
    .select("*")
    .eq("id", input.notificationId)
    .eq("type", "shift_swap_request")
    .in("status", ["unread", "read"])
    .maybeSingle();

  if (!notification) {
    return { ok: false, message: "This shift swap request has already been handled or expired." };
  }

  const meta =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    !Array.isArray(notification.metadata)
      ? (notification.metadata as Record<string, unknown>)
      : {};

  const targetDate = String(meta.targetDate ?? "");
  const dateLabel = String(meta.dateLabel ?? targetDate);
  const requesterStaffId = String(meta.requesterStaffId ?? notification.actor_staff_id ?? "");
  const requesterName = String(meta.requesterName ?? "Staff member");
  const colleagueStaffId = String(meta.colleagueStaffId ?? notification.recipient_staff_id ?? "");
  const colleagueName = String(meta.colleagueName ?? me.full_name);

  if (colleagueStaffId !== me.id && requesterStaffId !== me.id) {
    return { ok: false, message: "You are not part of this shift swap request." };
  }

  // Allow requester to cancel or colleague to decline
  if (input.decision === "decline") {
    await admin
      .from("workspace_notifications")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        requires_action: false,
      })
      .eq("id", notification.id);

    if (colleagueStaffId === me.id && requesterStaffId) {
      await createOrUpdateNotification({
        branchId: me.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: requesterStaffId,
        actorStaffId: me.id,
        type: "shift_swap_declined",
        title: `Shift Swap Declined for ${dateLabel}`,
        body: `${colleagueName} is unable to swap shifts on ${dateLabel}. Your original schedule remains unchanged.`,
        entityType: "schedule",
        entityId: notification.id,
        actionHref: `/staff-portal/schedule?weekStart=${targetDate}`,
        priority: "normal",
        requiresAction: false,
        dedupeKey: `shift-swap-declined:${notification.id}`,
      });
    }

    revalidatePath("/staff-portal/schedule");
    revalidatePath("/staff/schedule");
    return { ok: true, message: "Shift swap request declined." };
  }

  // Colleague is accepting the swap!
  if (colleagueStaffId !== me.id) {
    return { ok: false, message: "Only the requested colleague can accept this shift swap." };
  }

  const requesterShift = (meta.requesterShift ?? {}) as {
    isWorking?: boolean;
    summary?: string;
    startTime?: string | null;
    endTime?: string | null;
    shiftType?: string | null;
    endsNextDay?: boolean;
  };
  const colleagueShift = (meta.colleagueShift ?? {}) as {
    isWorking?: boolean;
    summary?: string;
    startTime?: string | null;
    endTime?: string | null;
    shiftType?: string | null;
    endsNextDay?: boolean;
  };

  // Replace any existing override on targetDate for these 2 staff members and insert the temporary swapped overrides
  await admin
    .from("schedule_overrides")
    .delete()
    .eq("override_date", targetDate)
    .in("staff_id", [requesterStaffId, colleagueStaffId]);

  const overrideInserts = [
    // 1. Requester gets Colleague's schedule for targetDate
    {
      staff_id: requesterStaffId,
      override_date: targetDate,
      is_day_off: !colleagueShift.isWorking,
      start_time: colleagueShift.isWorking ? colleagueShift.startTime ?? null : null,
      end_time: colleagueShift.isWorking ? colleagueShift.endTime ?? null : null,
      shift_type: colleagueShift.isWorking ? (colleagueShift.shiftType ?? "single") : null,
      ends_next_day: Boolean(colleagueShift.endsNextDay),
      reason: colleagueShift.isWorking
        ? `Temporary Shift Swap with ${colleagueName} (${colleagueShift.summary})`
        : `Temporary Shift Swap: Covered by ${colleagueName}`,
      created_by: me.id,
    },
    // 2. Colleague gets Requester's schedule for targetDate
    {
      staff_id: colleagueStaffId,
      override_date: targetDate,
      is_day_off: !requesterShift.isWorking,
      start_time: requesterShift.isWorking ? requesterShift.startTime ?? null : null,
      end_time: requesterShift.isWorking ? requesterShift.endTime ?? null : null,
      shift_type: requesterShift.isWorking ? (requesterShift.shiftType ?? "single") : null,
      ends_next_day: Boolean(requesterShift.endsNextDay),
      reason: requesterShift.isWorking
        ? `Temporary Shift Swap: Covering for ${requesterName} (${requesterShift.summary})`
        : `Temporary Shift Swap with ${requesterName} (Day Off)`,
      created_by: me.id,
    },
  ];

  const { error: insertError } = await admin.from("schedule_overrides").insert(overrideInserts);
  if (insertError) {
    return {
      ok: false,
      message: "Could not save the temporary schedule swap. Please try again.",
    };
  }

  // Mark the request notification resolved
  await admin
    .from("workspace_notifications")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      requires_action: false,
    })
    .eq("id", notification.id);

  // 1. Notify Requester (Staff A) via Web Push + Portal that their swap is confirmed!
  await createOrUpdateNotification({
    branchId: me.branch_id,
    targetWorkspace: "staff",
    recipientStaffId: requesterStaffId,
    actorStaffId: me.id,
    type: "shift_swap_accepted",
    title: `Shift Swap Confirmed for ${dateLabel}!`,
    body: `${colleagueName} accepted your temporary shift swap for ${dateLabel}. Your schedule for ${dateLabel} is now: ${colleagueShift.summary ?? "Updated"}.`,
    entityType: "schedule",
    entityId: notification.id,
    actionHref: `/staff-portal/schedule?weekStart=${targetDate}`,
    priority: "high",
    requiresAction: false,
    dedupeKey: `shift-swap-accepted:${notification.id}`,
  });

  // 2. Notify CRM (Informational Log Only — requiresAction: false so CRM doesn't have to approve anything!)
  await createOrUpdateNotification({
    branchId: me.branch_id,
    targetWorkspace: "crm",
    actorStaffId: me.id,
    type: "schedule_suggestion_approved",
    title: `Temporary Shift Swap — ${dateLabel}`,
    body: `${colleagueName} (${requesterShift.summary ?? "On Duty"}) and ${requesterName} (${colleagueShift.summary ?? "Off"}) swapped shifts for ${dateLabel} only. Attendance QR will automatically recognize this swap.`,
    entityType: "schedule",
    entityId: notification.id,
    actionHref: `/crm/schedule`,
    priority: "normal",
    requiresAction: false,
    dedupeKey: `crm-shift-swap-log:${notification.id}`,
  });

  revalidatePath("/staff-portal/schedule");
  revalidatePath("/staff/schedule");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/attendance");

  return {
    ok: true,
    message: `Shift swap confirmed for ${dateLabel}! Attendance QR scanning is automatically updated for both of you.`,
  };
}

