import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";
import {
  type FollowUpRule,
  getBranchDateParts,
  minutesFromNow,
  hoursFromNow,
  bookingDateTimeToIso,
} from "@/lib/agents/follow-up";

const MINUTES_IN_30 = 30;
const HOURS_IN_2 = 2;
const HOURS_IN_4 = 4;
const HOURS_IN_24 = 24;
const DAYS_IN_3 = 3;

function makeResult(ruleId: string, triggered: number, errors = 0) {
  return { ruleId, triggered, errors };
}

/**
 * Bookings with pending payment for > 30 minutes get a CRM reminder task.
 */
const pendingPaymentReminder: FollowUpRule = {
  id: "pending_payment_30m",
  name: "Pending payment reminder (CRM)",
  run: async (ctx) => {
    const admin = createAdminClient();
    const cutoff = minutesFromNow(ctx.now, MINUTES_IN_30);

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, branch_id, booking_date, start_time, customer_id, status, payment_status, created_at")
      .or("status.eq.pending_payment,payment_status.eq.pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !bookings || bookings.length === 0) {
      return makeResult("pending_payment_30m", 0);
    }

    let triggered = 0;
    for (const booking of bookings) {
      try {
        await createOrUpdateWorkflowTask({
          branchId: booking.branch_id,
          workspaceScope: "crm",
          assignedToRole: "crm",
          taskType: "payment_follow_up",
          title: "Follow up on pending payment",
          body: `Booking on ${booking.booking_date} at ${booking.start_time} is still pending payment.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: `/crm/bookings`,
          priority: "high",
          dueAt: new Date(ctx.now.getTime() + 30 * 60_000).toISOString(),
          metadata: { source: "agent_follow_up", minutes_pending: MINUTES_IN_30 },
        });
        triggered++;
      } catch {
        // continue to next booking
      }
    }

    return makeResult("pending_payment_30m", triggered);
  },
};

/**
 * Bookings with pending payment for > 2 hours escalate to manager notification.
 */
const pendingPaymentEscalation: FollowUpRule = {
  id: "pending_payment_2h",
  name: "Pending payment escalation (Manager)",
  run: async (ctx) => {
    const admin = createAdminClient();
    const cutoff = hoursFromNow(ctx.now, HOURS_IN_2);

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, branch_id, booking_date, start_time, customer_id, status, payment_status, created_at")
      .or("status.eq.pending_payment,payment_status.eq.pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !bookings || bookings.length === 0) {
      return makeResult("pending_payment_2h", 0);
    }

    let triggered = 0;
    for (const booking of bookings) {
      try {
        await createOrUpdateNotification({
          branchId: booking.branch_id,
          targetWorkspace: "manager",
          targetRole: "manager",
          type: "payment_overdue",
          title: "Payment overdue",
          body: `Booking ${booking.id.slice(0, 8)} has been pending payment for over 2 hours.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: `/crm/bookings`,
          priority: "high",
          requiresAction: true,
          metadata: { source: "agent_follow_up", hours_pending: HOURS_IN_2 },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("pending_payment_2h", triggered);
  },
};

/**
 * Home-service bookings starting within 2 hours without a therapist assigned.
 */
const homeServiceNoTherapist: FollowUpRule = {
  id: "home_service_no_therapist_2h",
  name: "Home service missing therapist",
  run: async (ctx) => {
    const admin = createAdminClient();
    const { ymd } = getBranchDateParts(ctx.now, ctx.timezone);
    const twoHoursFromNow = new Date(ctx.now.getTime() + HOURS_IN_2 * 60 * 60_000).toISOString();

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, branch_id, booking_date, start_time, staff_id, delivery_type, customer_id")
      .eq("delivery_type", "home_service")
      .or(`staff_id.is.null,staff_id.eq.00000000-0000-0000-0000-000000000000`)
      .gte("booking_date", ymd)
      .lte("booking_date", twoHoursFromNow)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(100);

    if (error || !bookings || bookings.length === 0) {
      return makeResult("home_service_no_therapist_2h", 0);
    }

    // Filter to those actually starting within 2 hours.
    const upcoming = bookings.filter((b) => {
      const startIso = bookingDateTimeToIso(b.booking_date, b.start_time);
      return startIso <= twoHoursFromNow && startIso >= ctx.now.toISOString();
    });

    let triggered = 0;
    for (const booking of upcoming) {
      try {
        await createOrUpdateWorkflowTask({
          branchId: booking.branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: "home_service_dispatch_conflict",
          title: "Home service missing therapist",
          body: `Booking on ${booking.booking_date} at ${booking.start_time} has no therapist assigned and starts soon.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: `/manager/dispatch`,
          priority: "critical",
          dueAt: new Date(ctx.now.getTime() + 15 * 60_000).toISOString(),
          metadata: { source: "agent_follow_up" },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("home_service_no_therapist_2h", triggered);
  },
};

/**
 * Workflow tasks open for > 4 hours escalate to manager notification.
 */
const openWorkflowTaskEscalation: FollowUpRule = {
  id: "open_workflow_task_4h",
  name: "Open workflow task escalation (Manager)",
  run: async (ctx) => {
    const admin = createAdminClient();
    const cutoff = hoursFromNow(ctx.now, HOURS_IN_4);

    const { data: tasks, error } = await admin
      .from("workflow_tasks")
      .select("id, branch_id, workspace_scope, task_type, title, body, entity_type, entity_id, created_at")
      .eq("status", "open")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !tasks || tasks.length === 0) {
      return makeResult("open_workflow_task_4h", 0);
    }

    let triggered = 0;
    for (const task of tasks) {
      try {
        await createOrUpdateNotification({
          branchId: task.branch_id,
          targetWorkspace: "manager",
          targetRole: "manager",
          type: "staff_progress_required",
          title: "Task needs attention",
          body: task.body ?? `Task "${task.title}" has been open for over 4 hours.`,
          entityType: task.entity_type,
          entityId: task.entity_id,
          actionHref: task.task_type === "payment_follow_up" ? "/crm/bookings" : `/${task.workspace_scope}`,
          priority: "normal",
          requiresAction: true,
          metadata: { source: "agent_follow_up", hours_open: HOURS_IN_4 },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("open_workflow_task_4h", triggered);
  },
};

/**
 * Workflow tasks open for > 24 hours escalate to owner notification.
 */
const openWorkflowTaskOwnerEscalation: FollowUpRule = {
  id: "open_workflow_task_24h",
  name: "Open workflow task escalation (Owner)",
  run: async (ctx) => {
    const admin = createAdminClient();
    const cutoff = hoursFromNow(ctx.now, HOURS_IN_24);

    const { data: tasks, error } = await admin
      .from("workflow_tasks")
      .select("id, branch_id, workspace_scope, task_type, title, body, entity_type, entity_id, created_at")
      .eq("status", "open")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !tasks || tasks.length === 0) {
      return makeResult("open_workflow_task_24h", 0);
    }

    let triggered = 0;
    for (const task of tasks) {
      try {
        await createOrUpdateNotification({
          branchId: task.branch_id,
          targetWorkspace: "owner",
          targetRole: "owner",
          type: "staff_progress_required",
          title: "Task unresolved for over 24 hours",
          body: task.body ?? `Task "${task.title}" has been open for over 24 hours.`,
          entityType: task.entity_type,
          entityId: task.entity_id,
          actionHref: "/owner/notifications",
          priority: "high",
          requiresAction: true,
          metadata: { source: "agent_follow_up", hours_open: HOURS_IN_24 },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("open_workflow_task_24h", triggered);
  },
};

/**
 * Completed bookings without post-session follow-up for > 24 hours get a CRM task.
 */
const completedBookingFollowUp: FollowUpRule = {
  id: "completed_booking_follow_up_24h",
  name: "Completed booking follow-up",
  run: async (ctx) => {
    const admin = createAdminClient();
    const cutoff = hoursFromNow(ctx.now, HOURS_IN_24);

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, branch_id, booking_date, start_time, customer_id, session_completed_at")
      .eq("booking_progress_status", "completed")
      .not("session_completed_at", "is", null)
      .lt("session_completed_at", cutoff)
      .order("session_completed_at", { ascending: false })
      .limit(100);

    if (error || !bookings || bookings.length === 0) {
      return makeResult("completed_booking_follow_up_24h", 0);
    }

    let triggered = 0;
    for (const booking of bookings) {
      try {
        await createOrUpdateWorkflowTask({
          branchId: booking.branch_id,
          workspaceScope: "crm",
          assignedToRole: "crm",
          taskType: "post_session_follow_up",
          title: "Send post-session follow-up",
          body: `Booking on ${booking.booking_date} at ${booking.start_time} is complete. Send review or retention message.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: `/crm/customers/${booking.customer_id}`,
          priority: "normal",
          dueAt: new Date(ctx.now.getTime() + 4 * 60 * 60_000).toISOString(),
          metadata: { source: "agent_follow_up" },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("completed_booking_follow_up_24h", triggered);
  },
};

/**
 * Staff with no schedule set for next week get a manager reminder.
 */
const staffMissingSchedule: FollowUpRule = {
  id: "staff_missing_schedule_3d",
  name: "Staff missing schedule reminder",
  run: async (ctx) => {
    const admin = createAdminClient();
    const in3Days = new Date(ctx.now.getTime() + DAYS_IN_3 * 24 * 60 * 60_000);
    const targetDate = in3Days.toISOString().split("T")[0]!;
    const dayOfWeek = in3Days.getDay();

    const { data: staffRows, error: staffError } = await admin
      .from("staff")
      .select("id, branch_id, full_name")
      .eq("is_active", true)
      .neq("system_role", "owner")
      .limit(200);

    if (staffError || !staffRows || staffRows.length === 0) {
      return makeResult("staff_missing_schedule_3d", 0);
    }

    const staffIds = staffRows.map((s) => s.id);

    const [{ data: schedules }, { data: overrides }] = await Promise.all([
      admin
        .from("staff_schedules")
        .select("staff_id")
        .in("staff_id", staffIds)
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true),
      admin
        .from("schedule_overrides")
        .select("staff_id")
        .in("staff_id", staffIds)
        .eq("override_date", targetDate),
    ]);

    const coveredStaffIds = new Set([
      ...(schedules ?? []).map((s) => s.staff_id),
      ...(overrides ?? []).map((o) => o.staff_id),
    ]);

    const missing = staffRows.filter((s) => !coveredStaffIds.has(s.id));

    let triggered = 0;
    for (const staff of missing) {
      try {
        await createOrUpdateWorkflowTask({
          branchId: staff.branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: "staff_availability_conflict",
          title: "Staff missing schedule",
          body: `${staff.full_name} has no schedule set for ${targetDate} (${DAYS_IN_3} days away).`,
          entityType: "staff",
          entityId: staff.id,
          actionHref: "/crm/staff-availability",
          priority: "normal",
          dueAt: new Date(ctx.now.getTime() + 24 * 60 * 60_000).toISOString(),
          metadata: { source: "agent_follow_up", target_date: targetDate },
        });
        triggered++;
      } catch {
        // continue
      }
    }

    return makeResult("staff_missing_schedule_3d", triggered);
  },
};

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRule[] = [
  pendingPaymentReminder,
  pendingPaymentEscalation,
  homeServiceNoTherapist,
  openWorkflowTaskEscalation,
  openWorkflowTaskOwnerEscalation,
  completedBookingFollowUp,
  staffMissingSchedule,
];
