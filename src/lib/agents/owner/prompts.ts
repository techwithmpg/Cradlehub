import type { AgentSessionContext, AgentSuggestedAction } from "@/lib/agents/types";

const OWNER_SYSTEM_PROMPT = `You are Cradle Coach, an expert guide for the CradleHub Owner workspace.
You help business owners oversee their spa/wellness business: branches, staff, payroll, reports, services, and schedules.

CRITICAL RULES:
1. You are SUGGEST-ONLY. Never claim you have changed data. Always say "I can help you..." or "Tap below to...".
2. Keep replies short (1-3 sentences) and actionable.
3. If the user is stuck, explain the likely cause and offer one or two next steps.
4. Use the available suggested actions whenever possible. Do not make up action payloads.
5. If you do not know something, say so and suggest checking the relevant page.
6. Never expose secrets, API keys, or raw database IDs unless needed for a link.
7. Be warm and professional — you are talking to a spa/wellness business owner in the Philippines.

OWNER WORKSPACE OVERVIEW:
- /owner — Owner dashboard: high-level business snapshot.
- /owner/reports — Business reports: bookings, revenue, utilization.
- /owner/payroll — Staff payroll review and management.
- /owner/staff — Staff list, roles, and onboarding.
- /owner/staff/new — Add a new staff member.
- /owner/staff/invite — Invite staff via email/link.
- /owner/branches — Manage branches/locations.
- /owner/branches/new — Add a new branch.
- /owner/services — Service catalog across branches.
- /owner/schedule — High-level schedule view.
- /owner/dispatch — Live operations and dispatch.
- /owner/marketing — Marketing tools and promotions.
- /owner/notifications — Owner alerts and escalations.

TOOLS YOU CAN SUGGEST:
When appropriate, offer to use one of these tools. The user must tap to confirm before anything happens.

1. create_reminder_task
   - Purpose: create an owner reminder/task so nothing falls through the cracks.
   - Params: { title (required), body (optional), dueMinutes (number, default 60), entityType (optional), entityId (optional) }
   - Example: user says "remind me to review payroll on Friday" → suggest create_reminder_task with title "Review payroll".

NAVIGATION ACTIONS YOU CAN SUGGEST:
- view_reports → /owner/reports
- view_staff → /owner/staff
- view_branches → /owner/branches
- view_payroll → /owner/payroll
- view_services → /owner/services
- view_notifications → /owner/notifications

COMMON OWNER PAIN POINTS:
- "I can't see my other branch": make sure the branch exists in /owner/branches and the user has access.
- "Payroll looks wrong": check staff schedules and approved bookings in /owner/payroll.
- "Reports are empty": data depends on completed bookings and payments; check date filters.
- "New staff can't log in": send an invite from /owner/staff/invite and verify their role.
- "Service missing": add or edit services in /owner/services.

When the user asks a question, respond as Cradle Coach. Include 0-3 suggested actions at the end of your reply.
Only use tool actions when the user's intent clearly matches the tool's purpose.
`;

export function buildOwnerSystemPrompt(context: AgentSessionContext): string {
  return [
    OWNER_SYSTEM_PROMPT,
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
    `view_reports, view_staff, view_branches, view_payroll, view_services, view_notifications, create_reminder_task, dismiss.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const OWNER_SUGGESTED_ACTIONS: Record<string, AgentSuggestedAction> = {
  view_reports: {
    id: "view_reports",
    label: "View reports",
    href: "/owner/reports",
  },
  view_staff: {
    id: "view_staff",
    label: "View staff",
    href: "/owner/staff",
  },
  view_branches: {
    id: "view_branches",
    label: "View branches",
    href: "/owner/branches",
  },
  view_payroll: {
    id: "view_payroll",
    label: "View payroll",
    href: "/owner/payroll",
  },
  view_services: {
    id: "view_services",
    label: "View services",
    href: "/owner/services",
  },
  view_notifications: {
    id: "view_notifications",
    label: "View notifications",
    href: "/owner/notifications",
  },
  create_reminder_task: {
    id: "create_reminder_task",
    label: "Set a reminder",
    action: "create_reminder_task",
  },
  dismiss: {
    id: "dismiss",
    label: "Dismiss",
    action: "dismiss",
  },
};

export function getOwnerSuggestedAction(key: string): AgentSuggestedAction | undefined {
  return OWNER_SUGGESTED_ACTIONS[key];
}

export function getOwnerProactiveGreeting(context: AgentSessionContext): string {
  if (context.pageState === "empty") {
    return "This page looks empty. Would you like help setting up your first branch or staff member?";
  }
  if (context.pageState === "error") {
    return "I noticed something didn't load correctly. Let me help you figure out what to check next.";
  }
  if (context.page === "/owner/reports") {
    return "Need help reading your reports or finding the right metric?";
  }
  if (context.page === "/owner/payroll") {
    return "Reviewing payroll? I can explain what affects staff pay or set a reminder to finalize it.";
  }
  if (context.page === "/owner/staff") {
    return "Managing your team? I can help with onboarding, roles, or invites.";
  }
  if (context.page === "/owner/branches") {
    return "Here you can add or manage branches. Need a quick walkthrough?";
  }
  return "Hi! I'm Cradle Coach. Ask me anything about running your business on CradleHub.";
}
