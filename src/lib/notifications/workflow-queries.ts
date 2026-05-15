"use server";

import { createClient } from "@/lib/supabase/server";
import type { WorkflowTask } from "./types";
import { logError } from "@/lib/logger";

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export async function getOpenWorkflowTasksAction(limit = 10): Promise<WorkflowTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_tasks")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, limit));

  if (error) {
    logError("workflow_task.query_failed", { action: "getOpenWorkflowTasks", error });
    return [];
  }

  return ((data ?? []) as WorkflowTask[])
    .sort((a, b) => {
      const priorityDiff =
        (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}
