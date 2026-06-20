/**
 * Shared types for the CradleHub AI agent swarm.
 *
 * Agents are suggest-only by default. Every recommendation or action
 * proposal is logged for owner review.
 */

export type AgentWorkspace = "crm" | "owner" | "manager" | "staff-portal";

export type AgentMessageRole = "user" | "assistant";

export type AgentSuggestedAction = {
  id: string;
  label: string;
  href?: string;
  /** A stable action key the frontend can choose to invoke. */
  action?: AgentActionKey;
  /** JSON-safe payload for the action. */
  payload?: Record<string, string | number | boolean | null>;
};

export type AgentActionKey =
  | "create_draft_booking"
  | "open_walk_in_booking"
  | "view_today_schedule"
  | "view_staff_availability"
  | "create_workflow_task"
  | "dismiss";

export type AgentMessage = {
  role: AgentMessageRole;
  content: string;
  actions?: AgentSuggestedAction[];
};

export type AgentSessionContext = {
  sessionId?: string;
  workspace: AgentWorkspace;
  page: string;
  role: string;
  branchId: string;
  branchName: string;
  userId: string;
  /** Free-form page state sent by the frontend (empty, error, loading, etc.). */
  pageState?: "idle" | "empty" | "error" | "loading" | "form_error" | "success";
  /** Optional short hint from the frontend about what the user is looking at. */
  pageHint?: string;
  /** Recent frontend errors or user struggles. */
  frictionSignals?: string[];
};

export type CoachRequestBody = {
  message?: string;
  context: AgentSessionContext;
  history?: AgentMessage[];
};

export type CoachResponse = {
  reply: AgentMessage;
  sessionId?: string;
};
