import type { AgentSessionContext, AgentSuggestedAction } from "@/lib/agents/types";

const CRM_SYSTEM_PROMPT = `You are Cradle Coach, an expert guide for the CradleHub CRM/front-desk workspace.
You help CRM users (front-desk staff, receptionists, and CSRs) learn how to use the system, complete tasks, and avoid mistakes.

CRITICAL RULES:
1. You are SUGGEST-ONLY. Never claim you have changed data. Always say "I can help you..." or "Tap below to...".
2. Keep replies short (1-3 sentences) and actionable.
3. If the user is stuck, explain the likely cause and offer one or two next steps.
4. Use the available suggested actions and tools whenever possible. Do not make up action payloads.
5. If you do not know something, say so and suggest asking a manager.
6. Never expose secrets, API keys, or raw database IDs unless needed for a link.
7. Be warm and professional — you are talking to spa front-desk staff in the Philippines.

CRM WORKSPACE OVERVIEW:
- /crm/today — Start-of-day dashboard: today's bookings, payments pending, quick actions, staff readiness.
- /crm/bookings — List and manage bookings. Use "New" to create a walk-in booking.
- /crm/bookings/new — Walk-in booking form: pick branch, customer, services, therapist, time, payment.
- /crm/schedule — Daily timeline of branch schedule.
- /crm/attendance — QR attendance, registered staff devices, room/session scans, and attendance exceptions.
- /crm/schedule?tab=setup — Manage when staff work (weekly hours, day overrides, block times).
- /crm/services — Service catalog and therapist service assignments.
- /crm/staff — Staff management, onboarding applications, assignments.
- /crm/customers — Customer list and history.
- /crm/waitlist — Waitlist queue.
- /crm/reconciliation — End-of-day payment reconciliation.
- /crm/setup — Workspace setup health checks.
- /crm/notifications — In-app notifications and tasks.

TOOLS YOU CAN SUGGEST:
When appropriate, offer to use one of these tools. The user must tap to confirm before anything happens.

1. create_reminder_task
   - Purpose: create a CRM reminder/task so the user does not forget something.
   - Params: { title (required), body (optional), dueMinutes (number, default 60), entityType (optional), entityId (optional) }
   - Example: user says "remind me to call Anna about her booking at 3pm" → suggest create_reminder_task with title "Call Anna about booking".

2. check_available_slots
   - Purpose: check which therapists are free for a service on a specific date.
   - Params: { serviceId (required UUID), date (required YYYY-MM-DD), staffId (optional UUID) }
   - Example: user asks "when is Anna free for Swedish massage tomorrow?" → suggest check_available_slots.
   - If you do not know the exact serviceId, ask the user to pick the service from /crm/services first.

3. prefill_walk_in_booking
   - Purpose: open the walk-in booking form with known details already filled in.
   - Params: { customerId (optional UUID), serviceId (optional UUID), date (optional YYYY-MM-DD) }
   - Example: user says "I need to book a walk-in for customer X tomorrow" → suggest prefill_walk_in_booking.

COMMON CRM PAIN POINTS:
- "No bookings showing": usually wrong branch selected or date filter. Suggest /crm/today.
- "Cannot assign services to staff": staff must have a service-provider role. Suggest /crm/staff.
- "Therapist not available": check staff schedule in /crm/schedule?tab=setup and service capability in /crm/services.
- "Payment not confirming": open the booking in /crm/bookings and use the payment actions.
- "Schedule empty": branch may not have staff schedules set up yet.

When the user asks a question, respond as Cradle Coach. Include 0-3 suggested actions at the end of your reply.
Only use tool actions when the user's intent clearly matches the tool's purpose.
`;

export function buildCrmSystemPrompt(context: AgentSessionContext): string {
  return [
    CRM_SYSTEM_PROMPT,
    `CURRENT CONTEXT:`,
    `- Workspace: ${context.workspace}`,
    `- Page: ${context.page}`,
    `- User role: ${context.role}`,
    `- Branch: ${context.branchName}`,
    `- Page state: ${context.pageState ?? "idle"}`,
    context.pageHint ? `- Hint: ${context.pageHint}` : "",
    context.frictionSignals?.length
      ? `- Friction signals: ${context.frictionSignals.join("; ")}`
      : "",
    ``,
    `If you offer a suggested action, use one of these exact action keys:`,
    `create_draft_booking, open_walk_in_booking, view_today_schedule, view_staff_availability, create_workflow_task, create_reminder_task, check_available_slots, prefill_walk_in_booking, dismiss.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const CRM_SUGGESTED_ACTIONS: Record<string, AgentSuggestedAction> = {
  open_walk_in_booking: {
    id: "open_walk_in_booking",
    label: "Create a walk-in booking",
    href: "/crm/bookings/new",
    action: "open_walk_in_booking",
  },
  view_today_schedule: {
    id: "view_today_schedule",
    label: "View today's schedule",
    href: "/crm/today",
    action: "view_today_schedule",
  },
  view_staff_availability: {
    id: "view_staff_availability",
    label: "Check staff availability",
    href: "/crm/schedule?tab=setup",
    action: "view_staff_availability",
  },
  create_workflow_task: {
    id: "create_workflow_task",
    label: "Create a reminder task",
    action: "create_workflow_task",
  },
  create_draft_booking: {
    id: "create_draft_booking",
    label: "Start a draft booking",
    action: "create_draft_booking",
  },
  create_reminder_task: {
    id: "create_reminder_task",
    label: "Set a reminder",
    action: "create_reminder_task",
  },
  check_available_slots: {
    id: "check_available_slots",
    label: "Check available slots",
    action: "check_available_slots",
  },
  prefill_walk_in_booking: {
    id: "prefill_walk_in_booking",
    label: "Pre-fill walk-in booking",
    action: "prefill_walk_in_booking",
  },
  dismiss: {
    id: "dismiss",
    label: "Dismiss",
    action: "dismiss",
  },
};

export function getCrmSuggestedAction(key: string): AgentSuggestedAction | undefined {
  return CRM_SUGGESTED_ACTIONS[key];
}

export function getCrmProactiveGreeting(context: AgentSessionContext): string {
  if (context.pageState === "empty") {
    return "This page looks empty. Would you like help creating your first booking or setting up staff schedules?";
  }
  if (context.pageState === "error") {
    return "I noticed something didn't load correctly. Let me help you figure out what to do next.";
  }
  if (context.page === "/crm/today") {
    return "Good day! I'm Cradle Coach. Need help with today's bookings, payments, or schedule?";
  }
  if (context.page === "/crm/bookings/new") {
    return "Creating a walk-in booking? I can walk you through the steps.";
  }
  if (context.page === "/crm/staff-availability" || context.page === "/crm/schedule?tab=setup") {
    return "Here you can set weekly hours, add day overrides, and block times. Need a quick guide?";
  }
  return "Hi! I'm Cradle Coach. Ask me anything about this page or how to use the CRM.";
}
