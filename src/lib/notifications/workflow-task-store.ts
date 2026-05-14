import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateWorkflowTaskInput, ResolveWorkflowTaskInput } from "./types";
import {
  isUniqueViolation,
  OPEN_TASK_STATUSES,
  taskDedupeKey,
  validateSignalHref,
} from "./workflow-dedupe";

function taskPayload(input: CreateWorkflowTaskInput, dedupeKey: string) {
  return {
    branch_id: input.branchId ?? null,
    workspace_scope: input.workspaceScope,
    assigned_to_staff_id: input.assignedToStaffId ?? null,
    assigned_to_role: input.assignedToRole ?? null,
    task_type: input.taskType,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action_href: validateSignalHref(input.actionHref),
    priority: input.priority ?? "normal",
    status: "open",
    due_at: input.dueAt ?? null,
    completed_at: null,
    completed_by_staff_id: null,
    dedupe_key: dedupeKey,
    metadata: input.metadata ?? {},
  };
}

export async function createOrUpdateWorkflowTask(input: CreateWorkflowTaskInput): Promise<void> {
  const admin = createAdminClient();
  const dedupeKey = taskDedupeKey(input);
  const payload = taskPayload(input, dedupeKey);
  const existing = await admin
    .from("workflow_tasks")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .in("status", [...OPEN_TASK_STATUSES])
    .maybeSingle();

  if (existing.data) {
    const { error } = await admin
      .from("workflow_tasks")
      .update(payload)
      .eq("id", existing.data.id);
    if (error) console.error("[workflow_tasks] update failed", error.message);
    return;
  }

  const { error } = await admin.from("workflow_tasks").insert(payload);
  if (!error) return;
  if (isUniqueViolation(error)) {
    await admin.from("workflow_tasks").update(payload).eq("dedupe_key", dedupeKey);
    return;
  }
  console.error("[workflow_tasks] insert failed", { taskType: input.taskType, error: error.message });
}

export async function resolveWorkflowTask(input: ResolveWorkflowTaskInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("workflow_tasks")
    .update({
      status: input.status ?? "completed",
      completed_at: new Date().toISOString(),
      completed_by_staff_id: input.completedByStaffId ?? null,
    })
    .eq("dedupe_key", taskDedupeKey(input))
    .in("status", [...OPEN_TASK_STATUSES]);
  if (error) console.error("[workflow_tasks] resolve failed", error.message);
}
