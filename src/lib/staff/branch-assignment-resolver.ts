import "server-only";

import { createOrUpdateNotification, createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-signals";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import {
  canSeeAllBranchCorrectionRequests,
  type BranchCorrectionActor,
} from "./branch-correction-policy";
import type {
  BranchAssignmentIssue,
  BranchAssignmentIssueSource,
  BranchAssignmentIssueStatus,
  BranchAssignmentResolutionInput,
  BranchAssignmentResolutionResult,
  BranchAssignmentResolutionType,
  BranchAssignmentRootCause,
} from "./branch-correction-types";

type AdminClient = ReturnType<typeof createAdminClient>;

type BranchRelation =
  | { name: string | null }
  | Array<{ name: string | null }>
  | null
  | undefined;

type StaffRelation =
  | {
      full_name: string | null;
      nickname: string | null;
      staff_type: string | null;
      system_role: string | null;
      is_active: boolean | null;
    }
  | Array<{
      full_name: string | null;
      nickname: string | null;
      staff_type: string | null;
      system_role: string | null;
      is_active: boolean | null;
    }>
  | null
  | undefined;

type IssueRow = {
  id: string;
  staff_id: string;
  issue_source: string;
  status: string;
  profile_branch_id: string | null;
  affected_branch_id: string | null;
  scan_event_id: string | null;
  root_causes: string[] | null;
  repairs_requiring_review: Json;
  next_action: string | null;
  reason: string | null;
  created_at: string;
  decided_at: string | null;
  resolution_type: string | null;
  is_test: boolean;
  staff?: StaffRelation;
  profile_branch?: BranchRelation;
  affected_branch?: BranchRelation;
};

type BranchLinkRow = { staff_id: string; branch_id: string; branches?: BranchRelation };
type TemporaryAccessRow = {
  staff_id: string;
  branch_id: string;
  valid_until: string | null;
};

const ROOT_CAUSES = new Set<BranchAssignmentRootCause>([
  "profile_branch_incorrect",
  "schedule_branch_incorrect",
  "booking_branch_mismatch",
  "service_assignment_mismatch",
  "temporary_access_missing",
  "temporary_access_expired",
  "temporary_access_conflict",
  "incomplete_permanent_transfer",
  "inactive_primary_branch",
  "missing_primary_branch",
  "cross_branch_future_assignments",
  "open_attendance_branch_conflict",
  "wrong_qr_scan_only",
  "ambiguous_branch_state",
  "already_resolved",
]);

const RESOLUTIONS = new Set<BranchAssignmentResolutionType>([
  "correct_permanent_primary_branch",
  "grant_temporary_branch_access",
  "repair_schedule_branch",
  "repair_service_assignments",
  "review_future_bookings",
  "complete_incomplete_transfer",
  "fix_temporary_access_conflict",
  "confirm_wrong_qr_scan",
  "require_manual_review",
]);

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value ?? null;
}

function branchName(value: BranchRelation, fallback: string): string {
  return first(value)?.name ?? fallback;
}

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonArray(value: Json): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function jsonReviewItems(value: Json): Array<{ type: string; message: string }> {
  return jsonArray(value).flatMap((entry) =>
    typeof entry.type === "string" && typeof entry.message === "string"
      ? [{ type: entry.type, message: entry.message }]
      : []
  );
}

function normalizeIssueStatus(value: string): BranchAssignmentIssueStatus {
  return value === "resolved" || value === "resolved_with_booking_review" || value === "requires_review" || value === "dismissed"
    ? value
    : "open";
}

function normalizeRootCauses(values: string[] | null | undefined): BranchAssignmentRootCause[] {
  return (values ?? []).filter((value): value is BranchAssignmentRootCause => ROOT_CAUSES.has(value as BranchAssignmentRootCause));
}

function recommendedResolution(rootCauses: BranchAssignmentRootCause[]): BranchAssignmentResolutionType {
  if (rootCauses.includes("ambiguous_branch_state") || rootCauses.includes("open_attendance_branch_conflict")) return "require_manual_review";
  if (rootCauses.includes("temporary_access_conflict") || rootCauses.includes("temporary_access_expired")) return "fix_temporary_access_conflict";
  if (rootCauses.includes("profile_branch_incorrect") || rootCauses.includes("inactive_primary_branch") || rootCauses.includes("missing_primary_branch")) return "correct_permanent_primary_branch";
  if (rootCauses.includes("schedule_branch_incorrect")) return "repair_schedule_branch";
  if (rootCauses.includes("service_assignment_mismatch")) return "repair_service_assignments";
  if (rootCauses.includes("booking_branch_mismatch") || rootCauses.includes("cross_branch_future_assignments")) return "review_future_bookings";
  return "confirm_wrong_qr_scan";
}

function safeResolution(value: string | null): BranchAssignmentResolutionType | null {
  return value && RESOLUTIONS.has(value as BranchAssignmentResolutionType)
    ? value as BranchAssignmentResolutionType
    : null;
}

export async function createOrReuseBranchAssignmentIssueForAttendance(params: {
  staffId: string;
  profileBranchId: string | null;
  affectedBranchId: string;
  scanEventId: string | null;
  qrPointId: string;
  isTest: boolean;
}): Promise<{ id: string; created: boolean }> {
  const admin = createAdminClient();
  const dedupeKey = `${params.staffId}:attendance_scan:${params.affectedBranchId}`;
  const { data, error } = await admin
    .from("staff_branch_assignment_issues")
    .upsert({
      staff_id: params.staffId,
      issue_source: "attendance_scan",
      status: "open",
      dedupe_key: dedupeKey,
      profile_branch_id: params.profileBranchId,
      affected_branch_id: params.affectedBranchId,
      scan_event_id: params.scanEventId,
      root_causes: ["wrong_qr_scan_only"],
      profile_branch_snapshot: { branch_id: params.profileBranchId },
      metadata: {
        qr_point_id: params.qrPointId,
        scan_event_id: params.scanEventId,
        detection: "attendance_wrong_branch",
      },
      is_test: params.isTest,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) throw new Error("branch_assignment_issue_create_failed");
  if (data?.id) return { id: data.id, created: true };

  const { data: existing, error: existingError } = await admin
    .from("staff_branch_assignment_issues")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingError || !existing) throw new Error("branch_assignment_issue_lookup_failed");
  return { id: existing.id, created: false };
}

export async function getBranchAssignmentIssuesForActor(
  actor: BranchCorrectionActor
): Promise<BranchAssignmentIssue[]> {
  const admin = createAdminClient();
  let query = admin
    .from("staff_branch_assignment_issues")
    .select(`
      id, staff_id, issue_source, status, profile_branch_id, affected_branch_id,
      scan_event_id, root_causes, repairs_requiring_review, next_action, reason,
      created_at, decided_at, resolution_type, is_test,
      staff:staff!staff_branch_assignment_issues_staff_id_fkey(full_name, nickname, staff_type, system_role, is_active),
      profile_branch:branches!staff_branch_assignment_issues_profile_branch_id_fkey(name),
      affected_branch:branches!staff_branch_assignment_issues_affected_branch_id_fkey(name)
    `)
    .in("status", ["open", "requires_review", "resolved", "resolved_with_booking_review"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!canSeeAllBranchCorrectionRequests(actor.systemRole)) {
    if (!actor.branchId) return [];
    query = query.or(`affected_branch_id.eq.${actor.branchId},profile_branch_id.eq.${actor.branchId}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[staff/branch-assignment-resolver] issue inbox query failed", {
      code: error.code,
      actorRole: actor.systemRole,
    });
    return [];
  }

  const rows = (data ?? []) as IssueRow[];
  if (rows.length === 0) return [];
  const staffIds = [...new Set(rows.map((row) => row.staff_id))];
  const [duties, bookings, permissions, openAttendance] = await Promise.all([
    admin.from("staff_duty_assignments").select("staff_id, branch_id, branches(name)").in("staff_id", staffIds).eq("is_active", true),
    admin.from("bookings").select("staff_id, branch_id, branches(name)").in("staff_id", staffIds).gte("booking_date", new Date().toISOString().slice(0, 10)).not("status", "in", '("cancelled","completed","no_show")'),
    admin.from("staff_attendance_branch_assignments").select("staff_id, branch_id, valid_until").in("staff_id", staffIds).eq("status", "approved"),
    admin.from("staff_shift_checkins").select("staff_id").in("staff_id", staffIds).eq("status", "checked_in").is("checked_out_at", null),
  ]);

  if (duties.error || bookings.error || permissions.error || openAttendance.error) {
    console.error("[staff/branch-assignment-resolver] issue diagnostics query failed");
    return rows.map((row) => mapIssue(row, [], [], [], []));
  }

  const dutyRows = (duties.data ?? []) as BranchLinkRow[];
  const bookingRows = (bookings.data ?? []) as BranchLinkRow[];
  const permissionRows = (permissions.data ?? []) as TemporaryAccessRow[];
  const openRows = (openAttendance.data ?? []) as Array<{ staff_id: string }>;
  return rows.map((row) => mapIssue(
    row,
    dutyRows.filter((entry) => entry.staff_id === row.staff_id),
    bookingRows.filter((entry) => entry.staff_id === row.staff_id),
    permissionRows.filter((entry) => entry.staff_id === row.staff_id),
    openRows.filter((entry) => entry.staff_id === row.staff_id)
  ));
}

function mapIssue(
  row: IssueRow,
  duties: BranchLinkRow[],
  bookings: BranchLinkRow[],
  permissions: TemporaryAccessRow[],
  openAttendance: Array<{ staff_id: string }>
): BranchAssignmentIssue {
  const staff = first(row.staff);
  const scheduleBranches = [...new Set(duties.map((entry) => branchName(entry.branches, "Unknown branch")))];
  const bookingBranches = [...bookings.reduce((summary, entry) => {
    const name = branchName(entry.branches, "Unknown branch");
    summary.set(name, (summary.get(name) ?? 0) + 1);
    return summary;
  }, new Map<string, number>()).entries()].map(([name, count]) => ({ name, count }));
  const now = Date.now();
  const causes = new Set(normalizeRootCauses(row.root_causes));
  const scheduleBranchIds = new Set(duties.map((entry) => entry.branch_id));
  const bookingBranchIds = new Set(bookings.map((entry) => entry.branch_id));
  if (scheduleBranchIds.size > 0 && [...scheduleBranchIds].some((branchId) => branchId !== row.profile_branch_id)) causes.add("schedule_branch_incorrect");
  if (bookingBranchIds.size > 0 && [...bookingBranchIds].some((branchId) => branchId !== row.profile_branch_id)) causes.add("booking_branch_mismatch");
  if (permissions.some((entry) => entry.valid_until && new Date(entry.valid_until).getTime() <= now)) causes.add("temporary_access_expired");
  if (new Set(permissions.filter((entry) => !entry.valid_until || new Date(entry.valid_until).getTime() > now).map((entry) => entry.branch_id)).size > 1) causes.add("temporary_access_conflict");
  if (openAttendance.length > 0 && row.affected_branch_id && row.affected_branch_id !== row.profile_branch_id) causes.add("open_attendance_branch_conflict");
  if (row.affected_branch_id && row.affected_branch_id !== row.profile_branch_id) {
    if (scheduleBranchIds.has(row.affected_branch_id) || bookingBranchIds.has(row.affected_branch_id)) causes.add("profile_branch_incorrect");
    else if (!causes.has("schedule_branch_incorrect") && !causes.has("booking_branch_mismatch")) causes.add("wrong_qr_scan_only");
  }
  const rootCauses = [...causes];
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: staff?.full_name ?? "Staff member",
    staffNickname: staff?.nickname ?? null,
    staffType: staff?.staff_type ?? null,
    staffSystemRole: staff?.system_role ?? null,
    staffIsActive: staff?.is_active ?? false,
    source: row.issue_source as BranchAssignmentIssueSource,
    status: normalizeIssueStatus(row.status),
    profileBranchId: row.profile_branch_id,
    profileBranchName: branchName(row.profile_branch, "No active primary branch"),
    affectedBranchId: row.affected_branch_id,
    affectedBranchName: row.affected_branch_id ? branchName(row.affected_branch, "Affected branch") : null,
    scanEventId: row.scan_event_id,
    rootCauses,
    scheduleBranches,
    bookingBranches,
    activeTemporaryPermissionCount: permissions.filter((entry) => !entry.valid_until || new Date(entry.valid_until).getTime() > now).length,
    openAttendanceCount: openAttendance.length,
    recommendedResolution: recommendedResolution(rootCauses),
    repairsRequiringReview: jsonReviewItems(row.repairs_requiring_review),
    nextAction: row.next_action,
    reason: row.reason,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    resolutionType: safeResolution(row.resolution_type),
    isTest: row.is_test,
  };
}

function mapResolutionError(code: string | null | undefined): BranchAssignmentResolutionResult {
  if (code === "ISSUE_NOT_FOUND") return { ok: false, code: "NOT_FOUND", message: "This branch assignment issue was not found." };
  if (code === "ACTOR_NOT_AUTHENTICATED") return { ok: false, code: "UNAUTHENTICATED", message: "CRM access is required to resolve branch assignment issues." };
  if (code === "ACTOR_NOT_AUTHORIZED" || code === "ACTOR_BRANCH_MISMATCH") return { ok: false, code: "UNAUTHORIZED", message: "You are not authorized to resolve this branch assignment issue." };
  if (code === "ISSUE_ALREADY_FINAL") return { ok: false, code: "NOT_PENDING", message: "This branch assignment issue already has a final decision." };
  if (code === "REASON_REQUIRED") return { ok: false, code: "REASON_REQUIRED", message: "A reason is required for this branch assignment change." };
  if (code === "INVALID_TEMPORARY_VALIDITY") return { ok: false, code: "INVALID_TEMPORARY_VALIDITY", message: "Select a bounded temporary-access period." };
  if (code === "REQUIRES_REVIEW" || code === "STAFF_REQUIRES_REVIEW") return { ok: false, code: "REQUIRES_REVIEW", message: "This issue requires an authorized manager review before branch data changes." };
  return { ok: false, code: "RESOLUTION_FAILED", message: "The branch assignment decision could not be completed safely." };
}

export async function resolveBranchAssignmentIssueForActor(params: {
  actor: BranchCorrectionActor & { staffId: string; authUserId: string };
  input: BranchAssignmentResolutionInput;
}): Promise<BranchAssignmentResolutionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_staff_branch_assignment_issue", {
    p_issue_id: params.input.issueId,
    p_resolution_type: params.input.resolutionType,
    p_actor_auth_user_id: params.actor.authUserId,
    p_actor_staff_id: params.actor.staffId,
    p_reason: params.input.reason.trim(),
    p_effective_date: params.input.effectiveDate ?? undefined,
    p_valid_from: params.input.validFrom ?? undefined,
    p_valid_until: params.input.validUntil ?? undefined,
    p_selected_repairs: (params.input.selectedRepairs ?? {}) as Json,
    p_impact_summary: (params.input.impactSummary ?? {}) as Json,
  }).maybeSingle();

  if (error || !data) {
    console.error("[staff/branch-assignment-resolver] resolution RPC failed", {
      code: error?.code ?? null,
      resolutionType: params.input.resolutionType,
    });
    return mapResolutionError(error?.message);
  }

  if (!data.success) return mapResolutionError(data.code);
  const resolutionType = safeResolution(data.resolution_type);
  if (!resolutionType) return { ok: false, code: "RESOLUTION_FAILED", message: "The resolver returned an invalid decision." };

  const result: BranchAssignmentResolutionResult = {
    ok: true,
    issueId: data.issue_id,
    issueStatus: normalizeIssueStatus(data.issue_status),
    resolutionType,
    previousBranchId: data.previous_branch_id ?? null,
    resolvedBranchId: data.resolved_branch_id ?? null,
    temporaryAuthorizationId: data.temporary_authorization_id ?? null,
    repairsApplied: jsonArray(data.repairs_applied),
    repairsRequiringReview: jsonArray(data.repairs_requiring_review),
    nextAction: data.next_action,
    message: data.message,
  };

  await emitResolverSignals({ actorStaffId: params.actor.staffId, result });
  return result;
}

async function emitResolverSignals(params: {
  actorStaffId: string;
  result: Extract<BranchAssignmentResolutionResult, { ok: true }>;
}): Promise<void> {
  const metadata = {
    resolution_type: params.result.resolutionType,
    next_action: params.result.nextAction,
    repairs_applied: params.result.repairsApplied,
  };
  const notifications: Array<Promise<unknown>> = [
    createOrUpdateNotification({
      targetWorkspace: "crm",
      targetRole: "crm",
      actorStaffId: params.actorStaffId,
      type: params.result.issueStatus === "requires_review" ? "branch_assignment_issue_review_required" : "branch_assignment_issue_resolved",
      title: params.result.issueStatus === "requires_review" ? "Branch assignment review required" : "Branch assignment resolved",
      body: params.result.message,
      entityType: "staff_branch_assignment_issue",
      entityId: params.result.issueId,
      actionHref: "/crm/staff?tab=branch-corrections",
      priority: params.result.issueStatus === "requires_review" ? "high" : "low",
      requiresAction: params.result.issueStatus === "requires_review",
      metadata,
    }),
  ];
  if (params.result.issueStatus === "requires_review" || params.result.nextAction === "booking_review_required") {
    notifications.push(createOrUpdateWorkflowTask({
      workspaceScope: "manager",
      assignedToRole: "manager",
      taskType: params.result.nextAction === "booking_review_required" ? "staff.branch_assignment.booking_review" : "staff.branch_assignment.manual_review",
      title: params.result.nextAction === "booking_review_required" ? "Review future bookings after branch decision" : "Review branch assignment evidence",
      body: params.result.message,
      entityType: "staff_branch_assignment_issue",
      entityId: params.result.issueId,
      actionHref: "/crm/staff?tab=branch-corrections",
      priority: "high",
      metadata,
    }));
  }
  try {
    await Promise.all(notifications);
  } catch {
    console.error("[staff/branch-assignment-resolver] downstream signals failed", { issueId: params.result.issueId });
  }
}
