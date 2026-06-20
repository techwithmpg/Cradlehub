import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import { getAvailableSlots } from "@/lib/engine/availability";
import { logError } from "@/lib/logger";
import type { AgentSessionContext } from "@/lib/agents/types";

export type ToolResult = {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export type ToolInput = {
  tool: string;
  params: Record<string, unknown>;
  context: AgentSessionContext;
};

const SUPPORTED_TOOLS = [
  "create_reminder_task",
  "check_available_slots",
  "prefill_walk_in_booking",
] as const;

export function isSupportedTool(tool: string): tool is (typeof SUPPORTED_TOOLS)[number] {
  return SUPPORTED_TOOLS.includes(tool as (typeof SUPPORTED_TOOLS)[number]);
}

export async function executeAgentTool(input: ToolInput): Promise<ToolResult> {
  try {
    switch (input.tool) {
      case "create_reminder_task":
        return await createReminderTask(input.params, input.context);
      case "check_available_slots":
        return await checkAvailableSlots(input.params, input.context);
      case "prefill_walk_in_booking":
        return prefillWalkInBooking(input.params, input.context);
      default:
        return { ok: false, message: "Unsupported tool." };
    }
  } catch (err) {
    logError("agent_tool.execute_failed", {
      tool: input.tool,
      error: err,
      userId: input.context.userId,
    });
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Tool execution failed.",
    };
  }
}

async function createReminderTask(
  params: Record<string, unknown>,
  context: AgentSessionContext
): Promise<ToolResult> {
  const title = String(params.title ?? "").trim();
  const body = String(params.body ?? "").trim() || null;
  const entityType = params.entityType ? String(params.entityType) : "agent_reminder";
  const entityId = params.entityId ? String(params.entityId) : context.userId;
  const dueMinutes = Number(params.dueMinutes ?? 60);

  if (!title) {
    return { ok: false, message: "Task title is required." };
  }

  const dueAt = new Date(Date.now() + dueMinutes * 60_000).toISOString();

  await createOrUpdateWorkflowTask({
    branchId: context.branchId,
    workspaceScope: "crm",
    assignedToRole: "crm",
    taskType: "agent_reminder",
    title,
    body,
    entityType,
    entityId,
    actionHref: context.page,
    priority: "normal",
    dueAt,
    metadata: {
      created_by_agent: true,
      source_page: context.page,
    },
  });

  return {
    ok: true,
    message: `Reminder created: "${title}". You'll see it in your CRM notifications.`,
  };
}

async function checkAvailableSlots(
  params: Record<string, unknown>,
  context: AgentSessionContext
): Promise<ToolResult> {
  const serviceId = String(params.serviceId ?? "").trim();
  const date = String(params.date ?? "").trim();
  const staffId = params.staffId ? String(params.staffId) : undefined;

  if (!serviceId) {
    return { ok: false, message: "Service ID is required to check slots." };
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "A valid date (YYYY-MM-DD) is required." };
  }

  const slots = await getAvailableSlots({
    branchId: context.branchId,
    serviceId,
    date,
    staffId,
  });

  const available = slots.filter((s) => s.available);

  if (available.length === 0) {
    return {
      ok: true,
      message: `No available slots found for ${date}. Try another date or therapist.`,
      data: { date, count: 0, slots: [] },
    };
  }

  const byStaff = available.reduce<Record<string, string[]>>((acc, slot) => {
    acc[slot.staff_name] = acc[slot.staff_name] ?? [];
    acc[slot.staff_name]!.push(slot.slot_time.substring(0, 5));
    return acc;
  }, {});

  const summary = Object.entries(byStaff)
    .map(([name, times]) => `${name}: ${times.slice(0, 5).join(", ")}${times.length > 5 ? "..." : ""}`)
    .join("\n");

  return {
    ok: true,
    message: `Found ${available.length} available slot(s) for ${date}:\n${summary}`,
    data: { date, count: available.length, byStaff },
  };
}

function prefillWalkInBooking(
  params: Record<string, unknown>,
  context: AgentSessionContext
): ToolResult {
  const query = new URLSearchParams();
  query.set("branchId", context.branchId);
  if (params.customerId) query.set("customerId", String(params.customerId));
  if (params.serviceId) query.set("serviceId", String(params.serviceId));
  if (params.date) query.set("date", String(params.date));

  const href = `/crm/bookings/new?${query.toString()}`;

  return {
    ok: true,
    message: "Opening the walk-in booking form with the details you provided.",
    data: { href },
  };
}

/**
 * Looks up a service ID by name for the current branch.
 * Useful when the assistant only knows the human-readable service name.
 */
export async function resolveServiceIdByName(
  branchId: string,
  name: string
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("services")
      .select("id, name")
      .ilike("name", `%${name}%`)
      .limit(1)
      .single();
    return (data?.id as string | null) ?? null;
  } catch {
    return null;
  }
}
